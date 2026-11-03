ALTER TABLE "ProductImage" ADD COLUMN "sourceUrlHash" TEXT;
CREATE UNIQUE INDEX "ProductImage_productId_sourceUrlHash_key" ON "ProductImage"("productId", "sourceUrlHash");
