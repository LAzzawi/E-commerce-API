import type { Request, Response, NextFunction } from "express";
import { type ZodTypeAny } from "zod/v4";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

declare global {
  namespace Express {
    interface Request {
      validated: {
        query: Record<string, unknown>;
        params: Record<string, unknown>;
      };
    }
  }
}

export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.validated) {
      req.validated = { query: {}, params: {} };
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body) as unknown;
    }
    if (schemas.query) {
      req.validated.query = schemas.query.parse(req.query) as Record<
        string,
        unknown
      >;
    }
    if (schemas.params) {
      req.validated.params = schemas.params.parse(req.params) as Record<
        string,
        unknown
      >;
    }
    next();
  };
}
