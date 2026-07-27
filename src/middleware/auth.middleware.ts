import type { Response, NextFunction, Request } from "express";
import { JWT } from "../utils/jwt.js";
import { ErrorResponse } from "../utils/response.utils.js";
import { statusCode } from "../types/types.js";
import prisma from "../config/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phoneNumber: string;
  };
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(";").map((c) => c.trim().split("="))
    );
    token = cookies["user_token"];
  }

  if (!token) {
    return next(new ErrorResponse("Not authorized, no token provided", statusCode.Unauthorized));
  }

  const decoded = JWT.verifyToken(token);

  if (decoded instanceof Error || !decoded || typeof decoded !== "object" || !("id" in decoded)) {
    return next(new ErrorResponse("Not authorized, token is invalid or expired", statusCode.Unauthorized));
  }

  try {
    const userExists = await prisma.user.findUnique({
      where: { id: (decoded as any).id }
    });
    if (!userExists) {
      return next(new ErrorResponse("Not authorized, user not found", statusCode.Unauthorized));
    }
  } catch (err) {
    return next(new ErrorResponse("Authentication verification failed", statusCode.Internal_Server_Error));
  }

  (req as AuthenticatedRequest).user = decoded as { id: string; phoneNumber: string };
  next();
};

export const optionalProtect = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(";").map((c) => c.trim().split("="))
    );
    token = cookies["user_token"];
  }

  if (token) {
    const decoded = JWT.verifyToken(token);
    if (!(decoded instanceof Error) && decoded && typeof decoded === "object" && "id" in decoded) {
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: (decoded as any).id }
        });
        if (userExists) {
          (req as AuthenticatedRequest).user = decoded as { id: string; phoneNumber: string };
        }
      } catch (err) {
        // ignore error for optional protect
      }
    }
  }

  next();
};
