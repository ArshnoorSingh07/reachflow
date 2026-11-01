import nodemailer from "nodemailer";
export async function createEtherealAccount() {
  // Nodemailer otherwise reuses one cached account, which would collapse distinct senders.
  process.env.ETHEREAL_CACHE = "no";
  return nodemailer.createTestAccount();
}
