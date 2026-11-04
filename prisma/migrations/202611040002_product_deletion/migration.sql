-- Retain products referenced by orders and inventory history while removing
-- them from the catalog. Existing statuses and records remain unchanged.
ALTER TABLE "Product" DROP CONSTRAINT "product_status";
ALTER TABLE "Product" ADD CONSTRAINT "product_status"
  CHECK ("status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED'));
