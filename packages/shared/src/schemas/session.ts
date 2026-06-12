/** Session — one continuous data-taking run of a detector. */
import { z } from "zod";
import { IdSchema, EpochMsSchema } from "./primitives.js";

export const SessionSchema = z
  .object({
    id: IdSchema,
    detectorId: IdSchema,
    startedAt: EpochMsSchema,
    /** null while the session is still recording. */
    endedAt: EpochMsSchema.nullable().default(null),
    /** Hash of the source log file, used for upload de-duplication. */
    sourceFileHash: z.string().optional(),
  })
  .strict()
  .refine((s) => s.endedAt === null || s.endedAt >= s.startedAt, {
    message: "endedAt must be at or after startedAt",
    path: ["endedAt"],
  });

export type Session = z.infer<typeof SessionSchema>;
