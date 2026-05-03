import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, ilike, and, count, type SQL } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import { NotFoundError } from "../lib/errors.js";
import {
  paginationSchema,
  paginate,
  paginatedResponse,
} from "../lib/pagination.js";

const router: IRouter = Router();

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(""),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Price must be a valid decimal"),
  stock: z.number().int().min(0).optional().default(0),
  category: z.string().max(100).optional().default(""),
  imageUrl: z.string().url().optional().nullable(),
});

const updateProductSchema = createProductSchema.partial();

const uuidSchema = z.object({ id: z.uuid() });

const listProductsSchema = paginationSchema.extend({
  category: z.string().optional(),
  search: z.string().optional(),
});

router.get(
  "/products",
  validate({ query: listProductsSchema }),
  async (req, res, next) => {
    try {
      const q = req.validated.query as z.infer<typeof listProductsSchema>;
      const { offset, limit } = paginate(q.page, q.limit);

      const conditions: SQL[] = [];
      if (q.category) conditions.push(eq(productsTable.category, q.category));
      if (q.search) conditions.push(ilike(productsTable.name, `%${q.search}%`));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await db
        .select({ total: count() })
        .from(productsTable)
        .where(where);

      const products = await db
        .select()
        .from(productsTable)
        .where(where)
        .limit(limit)
        .offset(offset);

      res.json(paginatedResponse(products, Number(total), q.page, q.limit));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/products/:id",
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const [product] = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, id))
        .limit(1);

      if (!product) throw new NotFoundError("Product");
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/products",
  requireAuth,
  requireRole("admin"),
  validate({ body: createProductSchema }),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createProductSchema>;
      const [product] = await db.insert(productsTable).values(body).returning();
      res.status(201).json(product);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/products/:id",
  requireAuth,
  requireRole("admin"),
  validate({ params: uuidSchema, body: updateProductSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const body = req.body as z.infer<typeof updateProductSchema>;
      const [product] = await db
        .update(productsTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(productsTable.id, id))
        .returning();

      if (!product) throw new NotFoundError("Product");
      res.json(product);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/products/:id",
  requireAuth,
  requireRole("admin"),
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const [product] = await db
        .delete(productsTable)
        .where(eq(productsTable.id, id))
        .returning({ id: productsTable.id });

      if (!product) throw new NotFoundError("Product");
      res.json({ message: "Product deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
