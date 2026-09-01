import { defineEnvVars } from "@sveltejs/kit/env";
import { z } from "zod";

export const variables = defineEnvVars({
  DATABASE_URL: {},
  ENCRYPTION_KEY: {
    schema: z.string().optional(),
  },
  REDIS_URL: {
    schema: z.string().optional(),
  },
});
