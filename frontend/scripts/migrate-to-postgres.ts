/**
 * PostgreSQL Migration Guide (G-015)
 * Run these steps to migrate from SQLite to PostgreSQL
 *
 * STEP 1: Install PostgreSQL and create database
 *   brew install postgresql && brew services start postgresql
 *   createdb groceryos_production
 *
 * STEP 2: Update your .env.local (and production env):
 *   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/groceryos_production"
 *
 * STEP 3: Update prisma/schema.prisma datasource:
 *   datasource db {
 *     provider = "postgresql"
 *     url      = env("DATABASE_URL")
 *   }
 *
 * STEP 4: Generate migration from current schema
 *   npx prisma migrate dev --name init_postgres
 *
 * STEP 5: Data migration — export from SQLite and import to PostgreSQL
 *   See migration script below
 *
 * STEP 6: Verify data integrity
 *   npx prisma studio
 */

import { PrismaClient as SQLiteClient } from "@prisma/client";

/**
 * Run this script ONCE to migrate existing SQLite data to PostgreSQL.
 * Usage: npx ts-node migrate-to-postgres.ts
 *
 * Ensure both DATABASE_URL (postgres) and SQLITE_URL (file:./prisma/dev.db)
 * are set before running.
 */
async function main() {
  // Source: SQLite
  const sqliteUrl = process.env.SQLITE_URL ?? "file:./prisma/dev.db";
  const sqlite    = new SQLiteClient({ datasources: { db: { url: sqliteUrl } } });

  // Destination: PostgreSQL (use DATABASE_URL from env)
  const postgres  = new SQLiteClient(); // same client, different datasource

  console.log("Starting data migration: SQLite → PostgreSQL");
  console.log("============================================");

  const tables = ["Product", "Customer", "Order", "Return", "Promo", "InventoryBatch", "Employee",
    "Coupon", "Review", "Supplier", "AuditLog", "ProductVariant", "WishlistItem",
    "AbandonedCart", "Refund", "BackInStockAlert", "LoyaltyAccount", "LoyaltyTransaction",
    "GiftCard", "Subscription", "RecentlyViewed"];

  for (const table of tables) {
    try {
      const records = await (sqlite as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
      if (records.length > 0) {
        await (postgres as any)[table.charAt(0).toLowerCase() + table.slice(1)].createMany({
          data:            records,
          skipDuplicates:  true,
        });
        console.log(`✅ ${table}: migrated ${records.length} records`);
      } else {
        console.log(`⏭  ${table}: empty, skipped`);
      }
    } catch (err: any) {
      console.error(`❌ ${table}: ${err.message}`);
    }
  }

  await sqlite.$disconnect();
  await postgres.$disconnect();
  console.log("============================================");
  console.log("Migration complete.");
}

main().catch(console.error);
