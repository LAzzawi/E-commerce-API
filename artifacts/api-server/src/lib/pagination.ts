import { z } from "zod/v4";

export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform(Number)
    .refine((n) => n >= 1, "page must be >= 1"),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform(Number)
    .refine((n) => n >= 1 && n <= 100, "limit must be between 1 and 100"),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function paginate(page: number, limit: number) {
  return {
    offset: (page - 1) * limit,
    limit,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
