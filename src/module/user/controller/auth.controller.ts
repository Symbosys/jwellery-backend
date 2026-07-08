import bcrypt from "bcryptjs";
import ENV from "../../../config/env.js";
import { LoginValidator, OtpValidator, AdminRegisterValidator, AdminLoginValidator } from "../validator/auth.validator.js";
import { asyncHandler } from "../../../middleware/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.utils.js";
import { statusCode } from "../../../types/types.js";
import prisma from "../../../config/prisma.js";
import { JWT } from "../../../utils/jwt.js";
import { generateOtp } from "../../../utils/otp.js";

const OTP_LENGTH = 4;
const OTP_EXPIRATION_MINUTES = 5;

const MAX_DAILY_OTP_REQUESTS = 50;
const COOLDOWN_MINUTES = 1;

// Controller: Request OTP
export const requestOtp = asyncHandler(async (req, res, next) => {
  const validData = OtpValidator.parse(req.body);

  if (!/^\+?\d{10,15}$/.test(validData.phoneNumber)) {
    throw new ErrorResponse(
      "Invalid phone number format",
      statusCode.Bad_Request
    );
  }

  const existingOtp = await prisma.otp.findUnique({
    where: { phoneNumber: validData.phoneNumber },
  });

  // Check if record is from a previous day (reset attempts if so)
  let attempts = 0;
  if (existingOtp) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const isSameDay = existingOtp.createdAt >= startOfDay;
    attempts = isSameDay ? existingOtp.attempts : 0;
  }

  // Enforce daily OTP request limit
  if (attempts >= MAX_DAILY_OTP_REQUESTS) {
    throw new ErrorResponse(
      `Maximum ${MAX_DAILY_OTP_REQUESTS} OTP requests per day reached`,
      429
    );
  }

  // Check cooldown period
  // if (existingOtp && existingOtp.lastAttemptedAt) {
  //   const cooldownEnd = new Date(existingOtp.lastAttemptedAt.getTime() + COOLDOWN_MINUTES * 60 * 1000);
  //   if (new Date() < cooldownEnd) {
  //     return next(new ErrorResponse(
  //       `Please wait ${COOLDOWN_MINUTES} minute(s) before requesting a new OTP`,
  //       statusCode.Too_Many_Requests
  //     ));
  //   }
  // }

  // Generate OTP and validate length
  const otp = generateOtp();

  if (otp.length !== OTP_LENGTH) {
    throw new ErrorResponse("Invalid OTP generated", statusCode.Bad_Request);
  }

  const expiresAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

  const hashedOtp = await bcrypt.hash(otp, 10);

  // Create or update OTP record
  await prisma.otp.upsert({
    where: { phoneNumber: validData.phoneNumber },
    update: {
      otp: hashedOtp,
      expiresAt,
      attempts: attempts + 1,
      isUsed: false,
      lastAttemptedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      phoneNumber: validData.phoneNumber,
      otp: hashedOtp,
      expiresAt,
      attempts: 1,
      lastAttemptedAt: new Date(),
    },
  });

  console.log("OTP", otp);

  return SuccessResponse(
    res,
    `OTP sent successfully. Your OTP is ${otp}`,
    { phoneNumber: validData.phoneNumber, otp },
    statusCode.OK
  );
});


const COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

export const verifyOtp = asyncHandler(async (req, res, next) => {
  const validData = LoginValidator.parse(req.body);

  // ✅ Start a transaction
  const result = await prisma.$transaction(async (tx) => {
    const storedOtp = await tx.otp.findUnique({
      where: { phoneNumber: validData.phoneNumber },
    });

    if (!storedOtp) throw new ErrorResponse("OTP not found", statusCode.Not_Found);

    if (new Date() > storedOtp.expiresAt) {
      await tx.otp.delete({ where: { id: storedOtp.id } });
      throw new ErrorResponse("OTP has expired", statusCode.Bad_Request);
    }

    if (storedOtp.isUsed) throw new ErrorResponse("OTP already used", statusCode.Bad_Request);

    // Check cooldown between verification attempts
    // if (storedOtp.lastAttemptedAt) {
    //   const cooldownEnd = new Date(storedOtp.lastAttemptedAt.getTime() + COOLDOWN_SECONDS * 1000);  // 30 seconds cooldown
    //   if (new Date() < cooldownEnd) {
    //     throw new ErrorResponse(
    //       `Please wait ${COOLDOWN_SECONDS} seconds before trying again`,
    //       statusCode.Too_Many_Requests
    //     );
    //   }
    // }

    const isMatch = await bcrypt.compare(validData.otp, storedOtp.otp);
    if (!isMatch) throw new ErrorResponse("Invalid OTP", statusCode.Bad_Request);

    // ✅ Mark OTP as used
    await tx.otp.update({
      where: { id: storedOtp.id },
      data: {
        isUsed: true,
        lastAttemptedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // ✅ Find or create user atomically
    let user = await tx.user.findUnique({
      where: { phoneNumber: validData.phoneNumber },
    });

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await tx.user.create({
        data: {
          phoneNumber: validData.phoneNumber,
        },
      });
    }

    return { user, isNewUser };
  });

  // ✅ Transaction successful — outside of the transaction scope now
  const { user, isNewUser } = result as { user: any; isNewUser: boolean };

  // Generate JWT token with custom payload (id, name, email, role, phoneNumber)
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim() || null;
  const token = JWT.generateToken({
    id: user.id.toString(),
    name,
    email: user.email || null,
    role: user.role || "CUSTOMER",
    phoneNumber: user.phoneNumber,
  });

  // Return response
  return res
    .status(statusCode.OK)
    .cookie("user_token", token, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    })
    .header("Authorization", `Bearer ${token}`)
    .json({
      success: true,
      message: isNewUser
        ? "Signup successful. You’ve received 1-month free Elite Membership!"
        : "Login successful",
      token,
      user: {
        ...user,
        id: user.id.toString(),
      },
    });
});


export const logout = asyncHandler(async (req, res, next) => {
  // ✅ Clear cookies and headers securely
  res.clearCookie("user_token", {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  // Optionally remove Authorization header (client should also remove it)
  res.removeHeader("Authorization");

  // ✅ Send success response
  return res.status(statusCode.OK).json({
    success: true,
    message: "Logout successful",
  });
});

// Controller: Admin Registration
export const adminRegister = asyncHandler(async (req, res, next) => {
  const validData = AdminRegisterValidator.parse(req.body);

  const existingUser = await prisma.user.findFirst({
    where: {
      email: validData.email,
    },
  });

  if (existingUser) {
    throw new ErrorResponse("User with this email already exists", statusCode.Conflict);
  }

  const hashedPassword = await bcrypt.hash(validData.password, 10);

  const admin = await prisma.user.create({
    data: {
      email: validData.email,
      password: hashedPassword,
      firstName: validData.firstName,
      lastName: validData.lastName,
      role: "ADMIN",
    } as any,
  }) as any;

  const token = JWT.generateToken({ email: admin.email || "", id: admin.id.toString(), role: admin.role });

  return res
    .status(statusCode.Created)
    .cookie("user_token", token, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })
    .header("Authorization", `Bearer ${token}`)
    .json({
      success: true,
      message: "Admin registered successfully",
      token,
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
      },
    });
});

// Controller: Admin Login
export const adminLogin = asyncHandler(async (req, res, next) => {
  const validData = AdminLoginValidator.parse(req.body);

  const user = await prisma.user.findUnique({
    where: {
      email: validData.email,
    },
  }) as any;

  if (!user) {
    throw new ErrorResponse("Invalid email or password", statusCode.Unauthorized);
  }

  if (user.role !== "ADMIN") {
    throw new ErrorResponse("Access denied. Admin only.", statusCode.Forbidden);
  }

  if (!user.password) {
    throw new ErrorResponse("Invalid credentials", statusCode.Unauthorized);
  }

  const isMatch = await bcrypt.compare(validData.password, user.password);
  if (!isMatch) {
    throw new ErrorResponse("Invalid email or password", statusCode.Unauthorized);
  }

  const token = JWT.generateToken({ email: user.email || "", id: user.id.toString(), role: user.role });

  return res
    .status(statusCode.OK)
    .cookie("user_token", token, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    })
    .header("Authorization", `Bearer ${token}`)
    .json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
});