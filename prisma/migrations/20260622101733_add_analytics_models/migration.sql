-- CreateTable
CREATE TABLE `store_analytics` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `totalSales` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `totalReturns` INTEGER NOT NULL DEFAULT 0,
    `totalCancelled` INTEGER NOT NULL DEFAULT 0,
    `visitsCount` INTEGER NOT NULL DEFAULT 0,
    `onTimeDeliveries` INTEGER NOT NULL DEFAULT 0,
    `lateDeliveries` INTEGER NOT NULL DEFAULT 0,
    `averageResponseTime` DOUBLE NOT NULL DEFAULT 0.0,
    `averageRating` DOUBLE NOT NULL DEFAULT 0.0,
    `totalReviews` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_analytics_date_key`(`date`),
    INDEX `store_analytics_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_analytics` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `viewsCount` INTEGER NOT NULL DEFAULT 0,
    `addToCartCount` INTEGER NOT NULL DEFAULT 0,
    `purchaseCount` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_analytics_productId_key`(`productId`),
    INDEX `product_analytics_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_analytics` ADD CONSTRAINT `product_analytics_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
