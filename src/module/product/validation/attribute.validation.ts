import { z } from "zod";

export const attributeValueItemSchema = z.union([
    z.string().min(1),
    z.object({
        value: z.string().min(1, "Value is required"),
        image: z.string().optional().nullable(),
    }),
]);

export const createAttributeSchema = z.object({
    name: z.string().min(1, "Attribute name is required"),
    values: z.array(attributeValueItemSchema).optional(),
});

export const addAttributeValuesSchema = z.object({
    values: z.array(attributeValueItemSchema).min(1, "At least one value is required"),
});

export const updateAttributeValueSchema = z.object({
    value: z.string().min(1, "Value cannot be empty").optional(),
    image: z.string().optional().nullable(),
});

