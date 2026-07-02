import type { ZodError } from "zod";

export const zodError = (error: ZodError) => {
  let errors: any = {};
  if (error.issues && error.issues.length > 0) {
    error.issues.forEach((issue) => {
      const path = issue.path && issue.path.length > 0 ? issue.path.join(".") : "_form";
      errors[path] = issue.message;
    });
  }
  return errors;
};