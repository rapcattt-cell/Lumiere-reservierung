import { asyncHandler } from "../middleware/asyncHandler";
import { getSettings, updateSettings } from "../services/settings.service";

export const getController = asyncHandler(async (_req, res) => {
  res.json(await getSettings());
});

export const updateController = asyncHandler(async (req, res) => {
  res.json(await updateSettings(req.body));
});

/** Öffentliche Teilmenge der Einstellungen für das Buchungsformular. */
export const publicController = asyncHandler(async (_req, res) => {
  const s = await getSettings();
  res.json({
    openingHours: s.openingHours,
    slotIntervalMin: s.slotIntervalMin,
    bookingWindowDays: s.bookingWindowDays,
    minPartySize: s.minPartySize,
    maxPartySize: s.maxPartySize,
  });
});
