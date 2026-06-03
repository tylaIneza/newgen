-- CreateTable branches
CREATE TABLE `branches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `location` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `branches_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Insert default Main Branch — all existing data will be assigned here
INSERT INTO `branches` (`id`, `name`, `location`, `is_active`, `created_at`)
VALUES (1, 'Main Branch', NULL, true, NOW());

-- AlterTable users: branch_id nullable (NULL = super-admin, no branch restriction)
ALTER TABLE `users` ADD COLUMN `branch_id` INTEGER NULL;
UPDATE `users` SET `branch_id` = 1;
ALTER TABLE `users` ADD INDEX `users_branch_id_idx`(`branch_id`);
ALTER TABLE `users` ADD CONSTRAINT `users_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable products: branch_id, change SKU uniqueness to per-branch scope
ALTER TABLE `products` ADD COLUMN `branch_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `products` DROP INDEX `products_sku_key`;
ALTER TABLE `products` ADD UNIQUE INDEX `products_sku_branch_key`(`sku`, `branch_id`);
ALTER TABLE `products` ADD INDEX `products_branch_id_idx`(`branch_id`);
ALTER TABLE `products` ADD CONSTRAINT `products_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable sales
ALTER TABLE `sales` ADD COLUMN `branch_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `sales` ADD INDEX `sales_branch_id_idx`(`branch_id`);
ALTER TABLE `sales` ADD CONSTRAINT `sales_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable expenses
ALTER TABLE `expenses` ADD COLUMN `branch_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `expenses` ADD INDEX `expenses_branch_id_idx`(`branch_id`);
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable capital_injections
ALTER TABLE `capital_injections` ADD COLUMN `branch_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `capital_injections` ADD INDEX `capital_injections_branch_id_idx`(`branch_id`);
ALTER TABLE `capital_injections` ADD CONSTRAINT `capital_injections_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable savings: add branch_id and change unique constraint from (date) to (date, branch_id)
ALTER TABLE `savings` ADD COLUMN `branch_id` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `savings` DROP INDEX `savings_date_key`;
ALTER TABLE `savings` ADD UNIQUE INDEX `savings_date_branch_key`(`date`, `branch_id`);
ALTER TABLE `savings` ADD CONSTRAINT `savings_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable audit_logs: nullable branch_id for context tracking
ALTER TABLE `audit_logs` ADD COLUMN `branch_id` INTEGER NULL;
ALTER TABLE `audit_logs` ADD INDEX `audit_logs_branch_id_idx`(`branch_id`);
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
