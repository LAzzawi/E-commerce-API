import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { eq, count } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../middlewares/validate.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../lib/errors.js";
import {
  paginationSchema,
  paginate,
  paginatedResponse,
} from "../lib/pagination.js";

const router: IRouter = Router();

const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1, "Order must have at least one item"),
});

const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

const uuidSchema = z.object({ id: z.uuid() });

router.post(
  "/orders",
  requireAuth,
  validate({ body: createOrderSchema }),
  async (req, res, next) => {
    try {
      const { items } = req.body as z.infer<typeof createOrderSchema>;
      const userId = req.user!.userId;

      const productIds = items.map((i) => i.productId);
      const products = await db
        .select()
        .from(productsTable)
        .where(
          productIds.length === 1
            ? eq(productsTable.id, productIds[0]!)
            : productsTable.id.in(productIds),
        );

      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) throw new NotFoundError(`Product ${item.productId}`);
        if (product.stock < item.quantity) {
          throw new BadRequestError(
            `Insufficient stock for "${product.name}". Available: ${product.stock}`,
          );
        }
      }

      let total = 0;
      const orderItemsData = items.map((item) => {
        const product = productMap.get(item.productId)!;
        const lineTotal = Number(product.price) * item.quantity;
        total += lineTotal;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        };
      });

      const [order] = await db
        .insert(ordersTable)
        .values({ userId, total: total.toFixed(2) })
        .returning();

      const insertedItems = await db
        .insert(orderItemsTable)
        .values(orderItemsData.map((i) => ({ ...i, orderId: order!.id })))
        .returning();

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        await db
          .update(productsTable)
          .set({ stock: product.stock - item.quantity, updatedAt: new Date() })
          .where(eq(productsTable.id, item.productId));
      }

      res.status(201).json({ ...order, items: insertedItems });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/orders",
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
        .from(ordersTable);
      const orders = await db
        .select()
        .from(ordersTable)
        .limit(limit)
        .offset(offset)
        .orderBy(ordersTable.createdAt);

      res.json(paginatedResponse(orders, Number(total), page, limit));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/orders/my",
  requireAuth,
  validate({ query: paginationSchema }),
  async (req, res, next) => {
    try {
      const { page, limit } = req.validated.query as z.infer<
        typeof paginationSchema
      >;
      const { offset } = paginate(page, limit);
      const userId = req.user!.userId;

      const [{ total }] = await db
        .select({ total: count() })
        .from(ordersTable)
        .where(eq(ordersTable.userId, userId));

      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.userId, userId))
        .limit(limit)
        .offset(offset)
        .orderBy(ordersTable.createdAt);

      res.json(paginatedResponse(orders, Number(total), page, limit));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/orders/:id",
  requireAuth,
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!order) throw new NotFoundError("Order");

      if (req.user!.role !== "admin" && req.user!.userId !== order.userId) {
        throw new ForbiddenError("You can only view your own orders");
      }

      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      res.json({ ...order, items });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/orders/:id/status",
  requireAuth,
  requireRole("admin"),
  validate({ params: uuidSchema, body: updateStatusSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const { status } = req.body as z.infer<typeof updateStatusSchema>;
      const [order] = await db
        .update(ordersTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(ordersTable.id, id))
        .returning();

      if (!order) throw new NotFoundError("Order");
      res.json(order);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/orders/:id",
  requireAuth,
  validate({ params: uuidSchema }),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params as z.infer<typeof uuidSchema>;
      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, id))
        .limit(1);

      if (!order) throw new NotFoundError("Order");

      if (req.user!.role !== "admin" && req.user!.userId !== order.userId) {
        throw new ForbiddenError("You can only cancel your own orders");
      }

      if (order.status !== "pending" && req.user!.role !== "admin") {
        throw new BadRequestError("Only pending orders can be cancelled");
      }

      await db
        .delete(orderItemsTable)
        .where(eq(orderItemsTable.orderId, order.id));

      await db.delete(ordersTable).where(eq(ordersTable.id, order.id));

      res.json({ message: "Order cancelled successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
