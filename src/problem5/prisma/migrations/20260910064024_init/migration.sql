-- CreateTable
CREATE TABLE "swap_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "fromAmount" DECIMAL NOT NULL,
    "toAmount" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "swap_orders_status_createdAt_idx" ON "swap_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "swap_orders_fromCurrency_toCurrency_idx" ON "swap_orders"("fromCurrency", "toCurrency");

-- CreateIndex
CREATE INDEX "swap_orders_walletAddress_idx" ON "swap_orders"("walletAddress");
