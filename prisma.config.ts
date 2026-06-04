import "dotenv/config";
import { defineConfig } from "prisma/config"
import "dotenv/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // This passes your connection string to Prisma for migrations
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});