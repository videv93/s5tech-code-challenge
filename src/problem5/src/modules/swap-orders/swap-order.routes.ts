import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { swapOrderController } from './swap-order.controller.js';
import {
  createSwapOrderSchema,
  idParamSchema,
  listSwapOrdersQuerySchema,
  updateSwapOrderSchema,
} from './swap-order.schema.js';

/**
 * The five interface functionalities the brief asks for, in order.
 * Validation is declared per-route so the contract is readable from the router
 * alone, without opening a handler.
 */
export const swapOrderRoutes = Router();

// 1. Create a resource.
swapOrderRoutes.post(
  '/',
  validateBody(createSwapOrderSchema),
  asyncHandler(swapOrderController.create),
);

// 2. List resources with basic filters.
swapOrderRoutes.get(
  '/',
  validateQuery(listSwapOrdersQuerySchema),
  asyncHandler(swapOrderController.list),
);

// 3. Get details of a resource.
swapOrderRoutes.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(swapOrderController.get),
);

// 4. Update resource details.
swapOrderRoutes.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateSwapOrderSchema),
  asyncHandler(swapOrderController.update),
);

// 5. Delete a resource.
swapOrderRoutes.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(swapOrderController.remove),
);
