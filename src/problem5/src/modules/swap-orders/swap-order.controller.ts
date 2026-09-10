import type { Request, Response } from 'express';
import { validated } from '../../middleware/validate.js';
import { swapOrderService } from './swap-order.service.js';
import type {
  CreateSwapOrderInput,
  ListSwapOrdersQuery,
  UpdateSwapOrderInput,
} from './swap-order.schema.js';

/**
 * Thin by design: translate HTTP to a service call and back. Every rule worth
 * testing lives in the service, so the controllers stay boring — which is what
 * lets the service be unit-tested without an HTTP layer at all.
 */
export const swapOrderController = {
  /** POST /api/v1/swap-orders */
  async create(req: Request, res: Response): Promise<void> {
    const order = await swapOrderService.create(req.body as CreateSwapOrderInput);
    // 201 + Location is what a REST client needs to follow the new resource.
    res.status(201).location(`${req.baseUrl}/${order.id}`).json({ data: order });
  },

  /** GET /api/v1/swap-orders */
  async list(_req: Request, res: Response): Promise<void> {
    const query = validated<ListSwapOrdersQuery>(res, 'query');
    const result = await swapOrderService.list(query);
    res.status(200).json(result);
  },

  /** GET /api/v1/swap-orders/:id */
  async get(_req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    res.status(200).json({ data: await swapOrderService.findById(id) });
  },

  /** PATCH /api/v1/swap-orders/:id */
  async update(req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    const order = await swapOrderService.update(id, req.body as UpdateSwapOrderInput);
    res.status(200).json({ data: order });
  },

  /** DELETE /api/v1/swap-orders/:id */
  async remove(_req: Request, res: Response): Promise<void> {
    const { id } = validated<{ id: string }>(res, 'params');
    await swapOrderService.delete(id);
    // 204: the deletion succeeded and there is deliberately nothing to return.
    res.status(204).send();
  },
};
