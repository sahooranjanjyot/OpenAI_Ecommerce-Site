const { PrismaClient: PostgresClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { execSync } = require("child_process");

async function main() {
  const postgresUrl = process.env.DATABASE_URL;

  if (!postgresUrl) {
    console.error("❌ DATABASE_URL environment variable is required.");
    process.exit(1);
  }

  // Destination: PostgreSQL
  const postgres = new PostgresClient({
    datasources: {
      db: { url: postgresUrl },
    },
  });

  console.log("🚀 Starting SQLite → PostgreSQL Database Migration (CLI + JSON)");
  console.log("==================================================");

  // Helper to run query via sqlite3 CLI
  const querySqlite = (tableName) => {
    try {
      const cmd = `sqlite3 -json prisma/dev.db "SELECT * FROM \\"${tableName}\\""`;
      const output = execSync(cmd, { maxBuffer: 100 * 1024 * 1024 }).toString().trim();
      if (!output) return [];
      return JSON.parse(output);
    } catch (err) {
      console.warn(`⚠️  Failed to query SQLite table ${tableName}: ${err.message}`);
      return [];
    }
  };

  // Helper to convert float pound values to integer pence values
  const toPence = (val) => {
    if (val === null || val === undefined) return undefined;
    return Math.round(val * 100);
  };

  // Helper to convert float pound values to integer pence values (nullable output)
  const toPenceNullable = (val) => {
    if (val === null || val === undefined) return null;
    return Math.round(val * 100);
  };

  const parseDate = (val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === "number") return new Date(val);
    return new Date(val);
  };

  const parseBool = (val) => {
    if (val === null || val === undefined) return undefined;
    return !!val;
  };

  // Truncate all destination tables first to prevent unique constraint conflicts
  console.log("Cleaning Postgres database...");
  const tableOrderForClean = [
    "OrderItem", "Order", "Review", "WishlistItem", "ProductVariant",
    "InventoryBatch", "BackInStockAlert", "RecentlyViewed", "ProductQA",
    "B2BPrice", "Layaway", "LocationStock", "LoyaltyTransaction", "Refund",
    "Return", "AffiliateConversion", "Customer", "Employee", "Product",
    "Location", "Supplier", "BlogPost", "Coupon", "GiftCard", "LoyaltyAccount",
    "Promo", "PriceRule", "ModerationQueue", "SupportTicket", "NewsletterSubscription",
    "FlashSale", "Affiliate", "B2BAccount", "Bundle", "DigitalDownload", "Subscription"
  ];
  for (const table of tableOrderForClean) {
    try {
      await postgres[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
    } catch (e) {
      // Ignore if table doesn't support clean yet
    }
  }
  console.log("✅ Postgres database cleaned.");
  console.log("--------------------------------------------------");

  // 1. Migrate Customers
  console.log("Migrating Customers...");
  try {
    const customers = querySqlite("Customer");
    for (const c of customers) {
      let passwordHash = c.password;
      if (c.password && !c.password.startsWith("$2")) {
        passwordHash = await bcrypt.hash(c.password, 12);
      }
      await postgres.customer.create({
        data: {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          blocked: parseBool(c.blocked),
          createdAt: parseDate(c.createdAt),
          updatedAt: parseDate(c.updatedAt),
          email: c.email,
          passwordHash: passwordHash,
          loyaltyPoints: c.loyaltyPoints ?? 0,
        },
      });
    }
    console.log(`✅ Customer: migrated ${customers.length} records`);
  } catch (err) {
    console.error(`❌ Customer: ${err.message}`);
  }

  // 2. Migrate Employees
  console.log("Migrating Employees...");
  try {
    const employees = querySqlite("Employee");
    for (const e of employees) {
      let passwordHash = e.password;
      if (e.password && !e.password.startsWith("$2")) {
        passwordHash = await bcrypt.hash(e.password, 12);
      }
      await postgres.employee.create({
        data: {
          id: e.id,
          userId: e.userId,
          password: e.password,
          passwordHash,
          name: e.name,
          role: e.role,
          modules: e.modules,
          active: parseBool(e.active),
          pin: e.pin,
          createdAt: parseDate(e.createdAt),
          updatedAt: parseDate(e.updatedAt),
        },
      });
    }
    console.log(`✅ Employee: migrated ${employees.length} records`);
  } catch (err) {
    console.error(`❌ Employee: ${err.message}`);
  }

  // 3. Migrate Products
  console.log("Migrating Products...");
  try {
    const products = querySqlite("Product");
    for (const p of products) {
      await postgres.product.create({
        data: {
          id: p.id,
          name: p.name,
          category: p.category,
          price: toPence(p.price),
          wasPrice: toPenceNullable(p.wasPrice),
          onSale: parseBool(p.onSale),
          promo: p.promo,
          stock: p.stock,
          unit: p.unit,
          image: p.image,
          description: p.description,
          enabled: parseBool(p.enabled),
          hidden: parseBool(p.hidden),
          featured: parseBool(p.featured),
          createdAt: parseDate(p.createdAt),
          updatedAt: parseDate(p.updatedAt),
          barcode: p.barcode,
          sku: p.barcode ? `SKU-${p.barcode}` : `SKU-${p.id}`,
        },
      });
    }
    console.log(`✅ Product: migrated ${products.length} records`);
  } catch (err) {
    console.error(`❌ Product: ${err.message}`);
  }

  // 4. Migrate Simple tables
  const simpleTables = [
    { name: "location", sqliteName: "Location" },
    { name: "supplier", sqliteName: "Supplier" },
    { name: "blogPost", sqliteName: "BlogPost" },
    { name: "loyaltyAccount", sqliteName: "LoyaltyAccount" },
    { name: "promo", sqliteName: "Promo" },
    { name: "moderationQueue", sqliteName: "ModerationQueue" },
    { name: "supportTicket", sqliteName: "SupportTicket" },
    { name: "newsletterSubscription", sqliteName: "NewsletterSubscription" },
    { name: "flashSale", sqliteName: "FlashSale" },
  ];

  for (const table of simpleTables) {
    console.log(`Migrating ${table.name}...`);
    try {
      const records = querySqlite(table.sqliteName);
      if (records.length > 0) {
        // Convert dates/booleans dynamically
        const mappedRecords = records.map(r => {
          const res = { ...r };
          if (res.createdAt) res.createdAt = parseDate(res.createdAt);
          if (res.updatedAt) res.updatedAt = parseDate(res.updatedAt);
          if (res.active !== undefined) res.active = parseBool(res.active);
          if (res.enabled !== undefined) res.enabled = parseBool(res.enabled);
          if (res.flagged !== undefined) res.flagged = parseBool(res.flagged);
          if (res.subscribed !== undefined) res.subscribed = parseBool(res.subscribed);
          if (res.published !== undefined) res.published = parseBool(res.published);
          if (res.publishedAt !== undefined) res.publishedAt = parseDate(res.publishedAt);
          if (res.unsubscribedAt !== undefined) res.unsubscribedAt = parseDate(res.unsubscribedAt);
          if (res.moderatedAt !== undefined) res.moderatedAt = parseDate(res.moderatedAt);
          if (res.startAt !== undefined) res.startAt = parseDate(res.startAt);
          if (res.endAt !== undefined) res.endAt = parseDate(res.endAt);
          return res;
        });

        await postgres[table.name].createMany({
          data: mappedRecords,
          skipDuplicates: true,
        });
        console.log(`✅ ${table.name}: migrated ${records.length} records`);
      } else {
        console.log(`⏭  ${table.name}: empty, skipped`);
      }
    } catch (err) {
      console.error(`❌ ${table.name}: ${err.message}`);
    }
  }

  // 5. Migrate Coupon
  console.log("Migrating Coupon...");
  try {
    const coupons = querySqlite("Coupon");
    for (const c of coupons) {
      const val = c.type === "percentage" ? Math.round(c.value) : toPence(c.value);
      await postgres.coupon.create({
        data: {
          id: c.id,
          code: c.code,
          type: c.type,
          value: val,
          minOrderValue: toPence(c.minOrderValue),
          maxUses: c.maxUses,
          usedCount: c.usedCount,
          expiresAt: parseDate(c.expiresAt),
          active: parseBool(c.active),
          createdAt: parseDate(c.createdAt),
        },
      });
    }
    console.log(`✅ Coupon: migrated ${coupons.length} records`);
  } catch (err) {
    console.error(`❌ Coupon: ${err.message}`);
  }

  // 6. Migrate GiftCard
  console.log("Migrating GiftCard...");
  try {
    const giftCards = querySqlite("GiftCard");
    for (const g of giftCards) {
      await postgres.giftCard.create({
        data: {
          id: g.id,
          code: g.code,
          balance: toPence(g.balance),
          initialBalance: toPence(g.initialBalance),
          recipientEmail: g.recipientEmail,
          message: g.message,
          issuedBy: g.issuedBy,
          active: parseBool(g.active),
          expiresAt: parseDate(g.expiresAt),
          createdAt: parseDate(g.createdAt),
        },
      });
    }
    console.log(`✅ GiftCard: migrated ${giftCards.length} records`);
  } catch (err) {
    console.error(`❌ GiftCard: ${err.message}`);
  }

  // 7. Migrate PriceRule
  console.log("Migrating PriceRule...");
  try {
    const priceRules = querySqlite("PriceRule");
    for (const pr of priceRules) {
      await postgres.priceRule.create({
        data: {
          id: pr.id,
          name: pr.name,
          type: pr.type,
          target: pr.target,
          discount: pr.discount,
          minQty: pr.minQty,
          startAt: parseDate(pr.startAt),
          endAt: parseDate(pr.endAt),
          active: parseBool(pr.active),
          priority: pr.priority,
          createdAt: parseDate(pr.createdAt),
        },
      });
    }
    console.log(`✅ PriceRule: migrated ${priceRules.length} records`);
  } catch (err) {
    console.error(`❌ PriceRule: ${err.message}`);
  }

  // 8. Migrate Affiliate
  console.log("Migrating Affiliate...");
  try {
    const affiliates = querySqlite("Affiliate");
    for (const a of affiliates) {
      await postgres.affiliate.create({
        data: {
          id: a.id,
          name: a.name,
          email: a.email,
          code: a.code,
          type: a.type,
          website: a.website,
          commissionRate: a.commissionRate,
          totalClicks: a.totalClicks,
          totalOrders: a.totalOrders,
          totalEarnings: toPence(a.totalEarnings),
          active: parseBool(a.active),
          createdAt: parseDate(a.createdAt),
        },
      });
    }
    console.log(`✅ Affiliate: migrated ${affiliates.length} records`);
  } catch (err) {
    console.error(`❌ Affiliate: ${err.message}`);
  }

  // 9. Migrate B2BAccount
  console.log("Migrating B2BAccount...");
  try {
    const accounts = querySqlite("B2BAccount");
    for (const a of accounts) {
      await postgres.b2bAccount.create({
        data: {
          id: a.id,
          companyName: a.companyName,
          contactName: a.contactName,
          email: a.email,
          phone: a.phone,
          website: a.website,
          vatNumber: a.vatNumber,
          companyReg: a.companyReg,
          monthlyVolume: a.monthlyVolume,
          creditTerms: a.creditTerms,
          industry: a.industry,
          status: a.status,
          discountRate: a.discountRate,
          creditLimit: toPence(a.creditLimit),
          createdAt: parseDate(a.createdAt),
        },
      });
    }
    console.log(`✅ B2BAccount: migrated ${accounts.length} records`);
  } catch (err) {
    console.error(`❌ B2BAccount: ${err.message}`);
  }

  // 10. Migrate ProductVariant
  console.log("Migrating ProductVariant...");
  try {
    const variants = querySqlite("ProductVariant");
    for (const v of variants) {
      await postgres.productVariant.create({
        data: {
          id: v.id,
          productId: v.productId,
          name: v.name,
          attribute: v.attribute,
          value: v.value,
          price: toPence(v.price),
          stock: v.stock,
          sku: v.sku,
          image: v.image,
          enabled: parseBool(v.enabled),
          createdAt: parseDate(v.createdAt),
        },
      });
    }
    console.log(`✅ ProductVariant: migrated ${variants.length} records`);
  } catch (err) {
    console.error(`❌ ProductVariant: ${err.message}`);
  }

  // 11. Migrate InventoryBatch
  console.log("Migrating InventoryBatch...");
  try {
    const batches = querySqlite("InventoryBatch");
    for (const b of batches) {
      await postgres.inventoryBatch.create({
        data: {
          id: b.id,
          productId: b.productId,
          quantity: b.quantity,
          remaining: b.remaining,
          costPrice: toPence(b.costPrice),
          supplier: b.supplier,
          channel: b.channel,
          createdAt: parseDate(b.createdAt),
          updatedAt: parseDate(b.updatedAt),
        },
      });
    }
    console.log(`✅ InventoryBatch: migrated ${batches.length} records`);
  } catch (err) {
    console.error(`❌ InventoryBatch: ${err.message}`);
  }

  // 12. Migrate BackInStockAlert
  console.log("Migrating BackInStockAlert...");
  try {
    const alerts = querySqlite("BackInStockAlert");
    for (const a of alerts) {
      await postgres.backInStockAlert.create({
        data: {
          id: a.id,
          email: a.email,
          productId: a.productId,
          notified: parseBool(a.notified),
          createdAt: parseDate(a.createdAt),
        },
      });
    }
    console.log(`✅ BackInStockAlert: migrated ${alerts.length} records`);
  } catch (err) {
    console.error(`❌ BackInStockAlert: ${err.message}`);
  }

  // 13. Migrate RecentlyViewed
  console.log("Migrating RecentlyViewed...");
  try {
    const viewed = querySqlite("RecentlyViewed");
    for (const v of viewed) {
      await postgres.recentlyViewed.create({
        data: {
          id: v.id,
          email: v.email,
          productId: v.productId,
          viewedAt: parseDate(v.viewedAt),
        },
      });
    }
    console.log(`✅ RecentlyViewed: migrated ${viewed.length} records`);
  } catch (err) {
    console.error(`❌ RecentlyViewed: ${err.message}`);
  }

  // 14. Migrate WishlistItem
  console.log("Migrating WishlistItem...");
  try {
    const wishlist = querySqlite("WishlistItem");
    for (const w of wishlist) {
      await postgres.wishlistItem.create({
        data: {
          id: w.id,
          email: w.email,
          productId: w.productId,
          createdAt: parseDate(w.createdAt),
        },
      });
    }
    console.log(`✅ WishlistItem: migrated ${wishlist.length} records`);
  } catch (err) {
    console.error(`❌ WishlistItem: ${err.message}`);
  }

  // 15. Migrate ProductQA
  console.log("Migrating ProductQA...");
  try {
    const qa = querySqlite("ProductQA");
    for (const q of qa) {
      await postgres.productQA.create({
        data: {
          id: q.id,
          productId: q.productId,
          question: q.question,
          author: q.author,
          email: q.email,
          answer: q.answer,
          answeredBy: q.answeredBy,
          isStaff: parseBool(q.isStaff),
          answered: parseBool(q.answered),
          answeredAt: parseDate(q.answeredAt),
          createdAt: parseDate(q.createdAt),
        },
      });
    }
    console.log(`✅ ProductQA: migrated ${qa.length} records`);
  } catch (err) {
    console.error(`❌ ProductQA: ${err.message}`);
  }

  // 16. Migrate B2BPrice
  console.log("Migrating B2BPrice...");
  try {
    const pricing = querySqlite("B2BPrice");
    for (const bp of pricing) {
      await postgres.b2bPrice.create({
        data: {
          id: bp.id,
          accountId: bp.accountId,
          productId: bp.productId,
          price: toPence(bp.price),
          minQty: bp.minQty,
        },
      });
    }
    console.log(`✅ B2BPrice: migrated ${pricing.length} records`);
  } catch (err) {
    console.error(`❌ B2BPrice: ${err.message}`);
  }

  // 17. Migrate Layaway
  console.log("Migrating Layaway...");
  try {
    const layaways = querySqlite("Layaway");
    for (const l of layaways) {
      await postgres.layaway.create({
        data: {
          id: l.id,
          email: l.email,
          productId: l.productId,
          qty: l.qty,
          instalments: l.instalments,
          totalAmount: toPence(l.totalAmount),
          depositAmount: toPence(l.depositAmount),
          depositPct: l.depositPct,
          remaining: toPence(l.remaining),
          paidAmount: toPence(l.paidAmount),
          paidCount: l.paidCount,
          address: l.address,
          phone: l.phone,
          schedule: l.schedule,
          status: l.status,
          createdAt: parseDate(l.createdAt),
          updatedAt: parseDate(l.updatedAt),
        },
      });
    }
    console.log(`✅ Layaway: migrated ${layaways.length} records`);
  } catch (err) {
    console.error(`❌ Layaway: ${err.message}`);
  }

  // 18. Migrate LocationStock
  console.log("Migrating LocationStock...");
  try {
    const stock = querySqlite("LocationStock");
    for (const ls of stock) {
      await postgres.locationStock.create({
        data: {
          id: ls.id,
          locationId: ls.locationId,
          productId: ls.productId,
          qty: ls.qty,
        },
      });
    }
    console.log(`✅ LocationStock: migrated ${stock.length} records`);
  } catch (err) {
    console.error(`❌ LocationStock: ${err.message}`);
  }

  // 19. Migrate LoyaltyTransaction
  console.log("Migrating LoyaltyTransaction...");
  try {
    const transactions = querySqlite("LoyaltyTransaction");
    for (const lt of transactions) {
      await postgres.loyaltyTransaction.create({
        data: {
          id: lt.id,
          email: lt.email,
          type: lt.type,
          points: lt.points,
          description: lt.description,
          createdAt: parseDate(lt.createdAt),
        },
      });
    }
    console.log(`✅ LoyaltyTransaction: migrated ${transactions.length} records`);
  } catch (err) {
    console.error(`❌ LoyaltyTransaction: ${err.message}`);
  }

  // 20. Migrate Orders & OrderItems
  console.log("Migrating Orders...");
  try {
    const orders = querySqlite("Order");
    let orderItemsCount = 0;
    for (const o of orders) {
      // Create PostgreSQL order record
      await postgres.order.create({
        data: {
          id: o.id,
          customerId: o.customerId,
          status: o.status,
          total: toPence(o.total),
          shippingAddr: o.address,
          idempotencyKey: o.idempotencyKey,
          createdAt: parseDate(o.createdAt),
          updatedAt: parseDate(o.createdAt),
        },
      });

      // Parse order items JSON and populate OrderItem table
      try {
        if (o.items) {
          const itemsArray = JSON.parse(o.items);
          if (Array.isArray(itemsArray)) {
            for (const item of itemsArray) {
              const pid = Number(item.id || item.productId);
              const qty = Number(item.qty || item.quantity || 1);
              const prc = toPence(Number(item.price || 0));
              if (isNaN(pid) || isNaN(qty) || isNaN(prc)) {
                console.warn(`⚠️ Skipped item on order #${o.id} due to NaN parsing:`, item);
                continue;
              }
              await postgres.orderItem.create({
                data: {
                  orderId: o.id,
                  productId: pid,
                  quantity: qty,
                  price: prc,
                },
              });
              orderItemsCount++;
            }
          }
        }
      } catch (jsonErr) {
        console.error(`⚠️ Failed to parse order items JSON for order #${o.id}: ${jsonErr.message}`);
      }
    }
    console.log(`✅ Order: migrated ${orders.length} orders and ${orderItemsCount} order items`);
  } catch (err) {
    console.error(`❌ Order: ${err.message}`);
  }

  // 21. Migrate Refund
  console.log("Migrating Refund...");
  try {
    const refunds = querySqlite("Refund");
    for (const r of refunds) {
      await postgres.refund.create({
        data: {
          id: r.id,
          orderId: r.orderId,
          amount: toPence(r.amount),
          reason: r.reason,
          type: r.type,
          status: r.status,
          processedBy: r.processedBy,
          createdAt: parseDate(r.createdAt),
        },
      });
    }
    console.log(`✅ Refund: migrated ${refunds.length} records`);
  } catch (err) {
    console.error(`❌ Refund: ${err.message}`);
  }

  // 22. Migrate Return
  console.log("Migrating Return...");
  try {
    const returns = querySqlite("Return");
    for (const r of returns) {
      await postgres.return.create({
        data: {
          id: r.id,
          orderId: r.orderId,
          productName: r.productName,
          quantity: r.quantity,
          reason: r.reason,
          condition: r.condition,
          refundAmount: toPence(r.refundAmount),
          restocked: parseBool(r.restocked),
          processedBy: r.processedBy,
          createdAt: parseDate(r.createdAt),
        },
      });
    }
    console.log(`✅ Return: migrated ${returns.length} records`);
  } catch (err) {
    console.error(`❌ Return: ${err.message}`);
  }

  // 23. Migrate AffiliateConversion
  console.log("Migrating AffiliateConversion...");
  try {
    const conversions = querySqlite("AffiliateConversion");
    for (const ac of conversions) {
      await postgres.affiliateConversion.create({
        data: {
          id: ac.id,
          affiliateId: ac.affiliateId,
          orderId: ac.orderId,
          orderTotal: toPence(ac.orderTotal),
          commission: toPence(ac.commission),
          createdAt: parseDate(ac.createdAt),
        },
      });
    }
    console.log(`✅ AffiliateConversion: migrated ${conversions.length} records`);
  } catch (err) {
    console.error(`❌ AffiliateConversion: ${err.message}`);
  }

  // 24. Migrate Review
  console.log("Migrating Review...");
  try {
    const reviews = querySqlite("Review");
    for (const r of reviews) {
      await postgres.review.create({
        data: {
          id: r.id,
          productId: r.productId,
          orderId: r.orderId,
          rating: r.rating,
          title: r.title,
          body: r.body,
          author: r.author,
          email: r.email,
          approved: parseBool(r.approved),
          createdAt: parseDate(r.createdAt),
        },
      });
    }
    console.log(`✅ Review: migrated ${reviews.length} records`);
  } catch (err) {
    console.error(`❌ Review: ${err.message}`);
  }

  // 25. Migrate Bundle
  console.log("Migrating Bundle...");
  try {
    const bundles = querySqlite("Bundle");
    for (const b of bundles) {
      await postgres.bundle.create({
        data: {
          id: b.id,
          name: b.name,
          description: b.description,
          productIds: b.productIds,
          discount: b.discount,
          enabled: parseBool(b.enabled),
          image: b.image,
          createdAt: parseDate(b.createdAt),
          updatedAt: parseDate(b.updatedAt),
        },
      });
    }
    console.log(`✅ Bundle: migrated ${bundles.length} records`);
  } catch (err) {
    console.error(`❌ Bundle: ${err.message}`);
  }

  // 26. Migrate DigitalDownload
  console.log("Migrating DigitalDownload...");
  try {
    const downloads = querySqlite("DigitalDownload");
    for (const d of downloads) {
      await postgres.digitalDownload.create({
        data: {
          id: d.id,
          productId: d.productId,
          token: d.token,
          downloadUrl: d.downloadUrl,
          licenseType: d.licenseType,
          maxDownloads: d.maxDownloads,
          downloads: d.downloads,
          expiresAt: parseDate(d.expiresAt),
          createdAt: parseDate(d.createdAt),
        },
      });
    }
    console.log(`✅ DigitalDownload: migrated ${downloads.length} records`);
  } catch (err) {
    console.error(`❌ DigitalDownload: ${err.message}`);
  }

  // 27. Migrate Subscription
  console.log("Migrating Subscription...");
  try {
    const subscriptions = querySqlite("Subscription");
    for (const s of subscriptions) {
      await postgres.subscription.create({
        data: {
          id: s.id,
          email: s.email,
          productId: s.productId,
          qty: s.qty,
          frequency: s.frequency,
          address: s.address,
          phone: s.phone,
          nextDelivery: parseDate(s.nextDelivery),
          active: parseBool(s.active),
          cancelledAt: parseDate(s.cancelledAt),
          createdAt: parseDate(s.createdAt),
          updatedAt: parseDate(s.updatedAt),
        },
      });
    }
    console.log(`✅ Subscription: migrated ${subscriptions.length} records`);
  } catch (err) {
    console.error(`❌ Subscription: ${err.message}`);
  }

  // 28. Migrate AbandonedCart
  console.log("Migrating AbandonedCart...");
  try {
    const abandonedCarts = querySqlite("AbandonedCart");
    for (const ac of abandonedCarts) {
      await postgres.abandonedCart.create({
        data: {
          id: ac.id,
          sessionId: ac.sessionId,
          email: ac.email,
          items: ac.items,
          createdAt: parseDate(ac.createdAt),
          updatedAt: parseDate(ac.updatedAt),
        },
      });
    }
    console.log(`✅ AbandonedCart: migrated ${abandonedCarts.length} records`);
  } catch (err) {
    console.error(`❌ AbandonedCart: ${err.message}`);
  }

  await postgres.$disconnect();
  console.log("==================================================");
  console.log("🎉 SQLite → PostgreSQL Migration completed successfully!");
}

main().catch((err) => {
  console.error("❌ Migration failed with error:", err);
  process.exit(1);
});
