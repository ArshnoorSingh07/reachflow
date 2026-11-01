import { google } from "../config/oauth.js";
import { UserModel } from "../models/user.model.js";
export async function authenticateGoogle(code: string) {
  const { tokens } = await google.getToken(code);
  if (!tokens.id_token) throw Error("Google did not return an identity token");
  const ticket = await google.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const profile = ticket.getPayload();
  if (!profile?.email_verified || !profile.email)
    throw Error("A verified Google email is required");
  const user = {
    id: profile.sub,
    name: profile.name ?? profile.email,
    email: profile.email,
    avatar: profile.picture ?? "",
  };
  await UserModel.upsertGoogleUser(user);
  return user;
}
