import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // This passes your connection string to Prisma for migrations
    url: env("DATABASE_URL_UNPOOLED"), 
  },
});