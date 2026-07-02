import z from "zod";

export const OtpValidator = z.object({
  phoneNumber: z.string().regex(/^\+?\d{10,15}$/, "Invalid mobile number format"),
});

export const LoginValidator = z.object({
  phoneNumber: z.string().regex(/^\+?\d{10,15}$/, "Invalid mobile number format"),
  otp: z.string().length(4, "OTP must be 4 digits"),
});

export const AdminRegisterValidator = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

export const AdminLoginValidator = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});