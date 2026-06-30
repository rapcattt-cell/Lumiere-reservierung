import { asyncHandler } from "../middleware/asyncHandler";
import * as service from "../services/reservation.service";

export const createController = asyncHandler(async (req, res) => {
  const r = await service.createReservation(req.body);
  res.status(201).json(r);
});

export const listController = asyncHandler(async (req, res) => {
  res.json(await service.listReservations(req.query as any));
});

export const getController = asyncHandler(async (req, res) => {
  res.json(await service.getReservation(req.params.id));
});

export const byNumberController = asyncHandler(async (req, res) => {
  res.json(await service.getByNumber(req.params.number));
});

export const updateController = asyncHandler(async (req, res) => {
  res.json(await service.updateReservation(req.params.id, req.body));
});

export const cancelController = asyncHandler(async (req, res) => {
  res.json(await service.cancelReservation(req.params.id));
});
