import { profileAvatar } from "../utils/avatar.js";
import { google } from "../config/oauth.js";
import { UserModel, findAccount } from "../models/user.model.js";
import { equalToken } from "./access-policy.service.js";
export async function authenticateGoogle(
  code: string,
  verifier: string,
  nonce: string,
) {
  const { tokens } = await google.getToken({ code, codeVerifier: verifier });
  if (!tokens.id_token) throw Error("Google did not return an identity token");
  const ticket = await google.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const profile = ticket.getPayload();
  if (
    !profile?.email_verified ||
    !profile.email ||
    !equalToken(nonce, profile.nonce)
  )
    throw Error("Google identity could not be verified");
  const existing = await findAccount(profile.sub);
  if (existing?.disabled_at) throw Error("This account is disabled");
  const user = {
    id: profile.sub,
    name: profile.name ?? profile.email,
    email: profile.email,
    avatar: profileAvatar(profile.name ?? profile.email),
  };
  await UserModel.upsertGoogleUser(user);
  return { user, sessionVersion: existing?.session_version ?? 0 };
}
