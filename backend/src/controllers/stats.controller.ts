import { asyncHandler } from "../middleware/asyncHandler";
import { overview } from "../services/stats.service";

export const overviewController = asyncHandler(async (req, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  res.json(await overview(from, to));
});
