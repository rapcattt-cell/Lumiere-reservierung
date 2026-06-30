import { asyncHandler } from "../middleware/asyncHandler";
import * as service from "../services/table.service";

export const listController = asyncHandler(async (_req, res) => {
  res.json(await service.listTables());
});

export const getController = asyncHandler(async (req, res) => {
  res.json(await service.getTable(req.params.id));
});

export const createController = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTable(req.body));
});

export const updateController = asyncHandler(async (req, res) => {
  res.json(await service.updateTable(req.params.id, req.body));
});

export const deleteController = asyncHandler(async (req, res) => {
  await service.deleteTable(req.params.id);
  res.json({ ok: true });
});
