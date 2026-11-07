import { z } from "zod";
import { mongoId } from "./validation";

export const campusProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LOCATION"),
    latitude: z.number().finite().min(-90).max(90).transform((v) => Number(v.toFixed(4))),
    longitude: z.number().finite().min(-180).max(180).transform((v) => Number(v.toFixed(4))),
    address: z.string().trim().min(5).max(300),
  }).strict(),
  z.object({
    kind: z.literal("PLACEMENT"),
    company: z.string().trim().min(2).max(120),
    academicYear: z.string().regex(/^20\d{2}-\d{2}$/, "Use an academic year such as 2026-27.").refine((v) => (Number(v.slice(0, 4)) + 1) % 100 === Number(v.slice(5)), "Academic year must cover consecutive years."),
    status: z.enum(["EXPECTED", "ANNOUNCED", "COMPLETED", "CANCELLED"]),
    departments: z.string().trim().min(2).max(300),
    eligibility: z.string().trim().min(10).max(1500),
    sourceUrl: z.string().trim().url().max(500).refine((v) => {
      try {
        const url = new URL(v);
        return url.protocol === "https:" && !url.username && !url.password;
      } catch { return false; }
    }, "Use a public HTTPS link to a placement notice or company page."),
  }).strict(),
]);

export const campusVoteSchema = z.object({ decisionId: mongoId, proposalId: mongoId.nullable() }).strict();
