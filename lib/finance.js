// ─── FINANCE: single source of truth for revenue/profit math ──────────────────
//
// Every owner-facing number (dashboard, analytics, AI insights) MUST derive its
// revenue/profit from the SQL expressions below. Do NOT hand-write these formulas
// in API routes — that is how dashboard and analytics drifted apart and produced
// the recurring profit bugs. Change a formula here, in ONE place, and every report
// updates together.
//
// All timestamps are stored in UTC; the shop runs on Nepal time (NPT = UTC+5:45),
// so day/month/year bucketing shifts by +5h45m before truncating.

// ─── NPT date helpers ─────────────────────────────────────────────────────────
export const NPT_TODAY      = "date('now', '+5 hours', '+45 minutes')";
export const NPT_MONTH      = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes')";
export const NPT_LAST_MONTH = "strftime('%Y-%m', 'now', '+5 hours', '+45 minutes', '-1 month')";
export const nptDate  = col => `date(${col}, '+5 hours', '+45 minutes')`;
export const nptMonth = col => `strftime('%Y-%m', ${col}, '+5 hours', '+45 minutes')`;
export const nptYear  = col => `strftime('%Y', ${col}, '+5 hours', '+45 minutes')`;

// ─── Sale line items (table alias `si` for sale_items) ────────────────────────
// Regular products carry a real quantity; used phones are stored as one row with
// quantity = 1 and product_id IS NULL. The combined SALE_* expressions work for
// both because quantity = 1 collapses the multiply.
export const PRODUCT_REVENUE = 'si.quantity * si.unit_price - COALESCE(si.item_discount, 0)';
export const PRODUCT_PROFIT  = 'si.quantity * (si.unit_price - si.cost_price) - COALESCE(si.item_discount, 0)';

// Phone-only line items (caller adds `si.product_id IS NULL`). Quantity is always 1.
export const PHONE_REVENUE = 'si.unit_price - COALESCE(si.item_discount, 0)';
export const PHONE_PROFIT  = 'si.unit_price - si.cost_price - COALESCE(si.item_discount, 0)';

// Combined products + phones. Same expression as products (quantity=1 for phones).
export const SALE_REVENUE = PRODUCT_REVENUE;
export const SALE_PROFIT  = PRODUCT_PROFIT;

// ─── Completed repairs (table `repairs`, bare columns) ────────────────────────
// Only Done/Delivered repairs count as realised. credit_discount is written ONLY
// at credit-clear time (see api/credits.js), so it is zero until a credit repair
// is cleared and is therefore always safe to subtract.
export const REPAIR_DONE    = "status IN ('Done', 'Delivered')";
export const REPAIR_REVENUE = 'customer_price - COALESCE(repair_discount, 0) - COALESCE(credit_discount, 0)';
export const REPAIR_PROFIT  = 'customer_price - COALESCE(cost_price, 0) - COALESCE(repair_discount, 0) - COALESCE(credit_discount, 0)';

// ─── Returns (table `sales_returns`, pre-computed amounts) ────────────────────
export const RETURN_REVENUE = 'return_amount';
export const RETURN_PROFIT  = 'return_profit';
