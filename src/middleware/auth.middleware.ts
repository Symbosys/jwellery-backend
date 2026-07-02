import type { Response, NextFunction, Request } from "express";
import { JWT } from "../utils/jwt.js";
import { ErrorResponse } from "../utils/response.utils.js";
import { statusCode } from "../types/types.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phoneNumber: string;
  };
}

export const protect = (req: Request, res: Response, next: NextFunction) => {
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

  (req as AuthenticatedRequest).user = decoded as { id: string; phoneNumber: string };
  next();
};

export const optionalProtect = (req: Request, res: Response, next: NextFunction) => {
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
      (req as AuthenticatedRequest).user = decoded as { id: string; phoneNumber: string };
    }
  }

  next();
};
