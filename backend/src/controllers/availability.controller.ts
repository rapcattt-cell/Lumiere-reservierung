import { asyncHandler } from "../middleware/asyncHandler";
import { getAvailability } from "../services/availability.service";

export const availabilityController = asyncHandler(async (req, res) => {
  const { date, party } = req.query as unknown as { date: string; party: number };
  res.json(await getAvailability(date, party));
});
