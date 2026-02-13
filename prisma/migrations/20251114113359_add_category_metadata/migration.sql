-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Category_venueId_isVisible_displayOrder_idx" ON "Category"("venueId", "isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "Product_venueId_categoryId_idx" ON "Product"("venueId", "categoryId");
