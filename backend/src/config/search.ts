export const emailIndex = process.env.ELASTIC_INDEX ?? "emails";
if (!/^[a-z][a-z0-9_-]*$/.test(emailIndex))
  throw Error("ELASTIC_INDEX must be a lowercase index name");
