import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { statusCode } from "../types/types.js";
import { ErrorResponse } from "../utils/response.utils.js";
import { zodError } from "../validation/index.js";

const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // handle Zod error first before assigning default status codes
  if (err instanceof ZodError || err.name === "ZodError") {
    const zodErr = zodError(err as any);
    return res.status(statusCode.Bad_Request).json({
      success: false,
      message: "Validation Error",
      errors: zodErr,
    });
  }

  err.message ||= "Internal Server Error";
  err.statusCode ||= 500;

  if (err.name === "CastError") err.message = "Invalid ID";
  if ("code" in err && err.code === "P2025") {
    err.message = "Item not found";
  }

  // Only log full stack traces for 500 Internal Server Errors, avoid flooding the terminal with 4xx user errors
  if (err.statusCode >= 500) {
    console.error("🔥 Error caught in middleware:", err);
  }

  // Final Error Response
  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

export default errorMiddleware;


type AsyncHandlerFunction<TReq extends Request> = (
  req: TReq,
  res: Response,
  next: NextFunction
) => Promise<any>;

export const asyncHandler =
  <TReq extends Request>(fn: AsyncHandlerFunction<TReq>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };



