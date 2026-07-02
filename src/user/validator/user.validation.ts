import { z } from "zod";

export const updateUsers = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: z.string().email("Invalid email address").optional(),
  phoneNumber: z.string().min(10, "Invalid phone number").optional(),
  // Passing the enum values from your Prisma model
  gender: z.enum(["FEMALE", "MALE", "OTHER"]).optional(),
  // Adding dateOfBirth to match your model
  dateOfBirth: z.string().datetime().optional() 
});