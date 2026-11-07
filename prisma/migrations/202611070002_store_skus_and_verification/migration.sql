ALTER TABLE "Product" ADD COLUMN "rightsReviewRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "rightsClearance" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProductVariant" ADD COLUMN "storeSku" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN "stockVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ProductVariant_storeSku_key" ON "ProductVariant"("storeSku");
CREATE TABLE "StoreSkuCounter" (
  "id" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StoreSkuCounter_pkey" PRIMARY KEY ("id")
);
