-- CreateTable
CREATE TABLE `capital_injections` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(255) NULL,
    `date` DATE NOT NULL,
    `added_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `capital_injections_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `capital_injections` ADD CONSTRAINT `capital_injections_added_by_fkey` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
