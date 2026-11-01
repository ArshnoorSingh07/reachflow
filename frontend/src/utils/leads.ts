import Papa from "papaparse";
import { z } from "zod";
const email = z.email();
export function parseLeads(text: string) {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  });
  const cells = parsed.data
    .flat()
    .flatMap((s) => s.split(/[;\s]+/))
    .map((x) => x.trim())
    .filter(Boolean);
  const valid = cells.filter((x) => email.safeParse(x).success);
  const emails = [...new Set(valid)];
  return {
    emails,
    ignored: cells.length - valid.length,
    duplicates: valid.length - emails.length,
  };
}
