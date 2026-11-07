ALTER TABLE "Product"
  ADD COLUMN "shortDescription" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "needsPriceReview" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StoreSettings"
  ADD COLUMN "legalName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "taxId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "businessAddress" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deliveryTime" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "deliveryFreeRegions" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ProductSlugAlias" (
  "oldSlug" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ProductSlugAlias_productId_idx" ON "ProductSlugAlias"("productId");
