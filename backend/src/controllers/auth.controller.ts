import { asyncHandler } from "../middleware/asyncHandler";
import * as authService from "../services/auth.service";

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  res.json(await authService.login(email, password));
});

export const refreshController = asyncHandler(async (req, res) => {
  res.json(await authService.refresh(req.body.refreshToken));
});

export const logoutController = asyncHandler(async (req, res) => {
  if (req.user) await authService.logout(req.user.sub);
  res.json({ ok: true });
});

export const meController = asyncHandler(async (req, res) => {
  res.json(await authService.me(req.user!.sub));
});
