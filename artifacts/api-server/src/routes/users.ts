import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";
import { eq, count } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";
import {
  paginationSchema,
  paginate,
  paginatedResponse,
} from "../lib/pagination.js";

const router: IRouter = Router();

const safeUserFields = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  role: usersTable.role,
  createdAt: usersTable.createdAt,
  updatedAt: usersTable.updatedAt,
};

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  password: z.string().min(8).optional(),
});

const uuidSchema = z.object({ id: z.uuid() });

router.get(
  "/users",
  requireAuth,
  requireRole("admin"),
  validate({ query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { page, limit } = req.validated.query as z.infer<
        typeof paginationSchema
      >;
      const { offset } = paginate(page, limit);

      const [{ total }] = await db
        .select({ total: count() })
        .from(usersTable);
      const users = await db
        .select(safeUserFields)
        .from(usersTable)
        .limit(limit)
        .offset(offset);

      res.json(paginatedResponse(users, Number(total), page, limit));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/users/:id",
  requireAuth,
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;

      if (req.user!.role !== "admin" && req.user!.userId !== id) {
        throw new ForbiddenError("You can only view your own profile");
      }

      const [user] = await db
        .select(safeUserFields)
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .limit(1);

      if (!user) throw new NotFoundError("User");
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/users/:id",
  requireAuth,
  validate({ params: uuidSchema, body: updateUserSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const body = req.body as z.infer<typeof updateUserSchema>;

      if (req.user!.role !== "admin" && req.user!.userId !== id) {
        throw new ForbiddenError("You can only update your own profile");
      }

      const updates: Partial<typeof usersTable.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.name) updates.name = body.name;
      if (body.password)
        updates.passwordHash = await bcrypt.hash(body.password, 12);

      const [user] = await db
        .update(usersTable)
        .set(updates)
        .where(eq(usersTable.id, id))
        .returning(safeUserFields);

      if (!user) throw new NotFoundError("User");
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/users/:id",
  requireAuth,
  requireRole("admin"),
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const [user] = await db
        .delete(usersTable)
        .where(eq(usersTable.id, id))
        .returning({ id: usersTable.id });

      if (!user) throw new NotFoundError("User");
      res.json({ message: "User deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
