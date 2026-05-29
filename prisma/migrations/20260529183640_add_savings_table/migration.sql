-- CreateTable
CREATE TABLE `savings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(12, 2) NOT NULL,
    `revenue_today` DECIMAL(12, 2) NOT NULL,
    `remaining_revenue` DECIMAL(12, 2) NOT NULL,
    `date` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `savings_date_idx`(`date`),
    UNIQUE INDEX `savings_date_key`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
