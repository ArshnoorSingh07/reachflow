import { OAuth2Client } from "google-auth-library";
export const google = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.API_URL}/auth/google/callback`,
);
