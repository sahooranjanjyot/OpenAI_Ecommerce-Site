export type ReorderAlertSeverity = "critical" | "warning" | "ok";

export interface ReorderAlert {
  productId: string;
  productName: string;
  daysLeft: number;
  reorderQty: number;
  severity: ReorderAlertSeverity;
  currentStock: number;
}

export interface InputProduct {
  id: string | number;
  name: string;
  currentStock: number;
  salesLast7Days: number[];
  leadTimeDays?: number;
  minOrderUnit?: number;
}

export function getReorderAlerts(products: InputProduct[]): ReorderAlert[] {
  const alerts: ReorderAlert[] = [];

  for (const product of products) {
    const leadTimeDays = product.leadTimeDays || 2;
    const minOrderUnit = product.minOrderUnit || 5;

    // 1. Calculate average daily sales
    const totalSales = product.salesLast7Days.reduce((acc, val) => acc + val, 0);
    const avgDailySales = totalSales / 7;

    // 2. If avgDailySales == 0 -> return no alert
    if (avgDailySales === 0) continue;

    // 3. Calculate buffer
    const buffer = 0.5 * avgDailySales;

    // 4. Calculate days of stock left
    const daysLeft = product.currentStock / avgDailySales;

    // 5. Trigger alert if daysLeft < (leadTimeDays + 1)
    if (daysLeft < leadTimeDays + 1) {
      // 6. Calculate reorder quantity
      let reorderQty = (avgDailySales * leadTimeDays) + buffer - product.currentStock;

      // 7. If reorderQty < 0 -> set to 0
      if (reorderQty < 0) reorderQty = 0;

      // 8. Round reorderQty to nearest minOrderUnit
      reorderQty = Math.ceil(reorderQty / minOrderUnit) * minOrderUnit;

      const severity: ReorderAlertSeverity = daysLeft < 1 ? "critical" : daysLeft < 2 ? "warning" : "ok";

      alerts.push({
        productId: String(product.id),
        productName: product.name,
        daysLeft: parseFloat(daysLeft.toFixed(1)), // Keep it rounded nicely
        reorderQty,
        severity,
        currentStock: product.currentStock
      });
    }
  }

  return alerts;
}
