-- AlterTable
ALTER TABLE "Product" ADD COLUMN "subCategoryId" TEXT;

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_venueId_categoryId_slug_key" ON "SubCategory"("venueId", "categoryId", "slug");

-- CreateIndex
CREATE INDEX "SubCategory_venueId_categoryId_isVisible_displayOrder_idx" ON "SubCategory"("venueId", "categoryId", "isVisible", "displayOrder");

-- CreateIndex
CREATE INDEX "Product_venueId_subCategoryId_idx" ON "Product"("venueId", "subCategoryId");

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
