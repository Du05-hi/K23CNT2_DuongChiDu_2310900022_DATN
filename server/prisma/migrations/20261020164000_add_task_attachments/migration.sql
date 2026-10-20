CREATE TABLE `TaskAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `fileType` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TaskAttachment_taskId_idx`(`taskId`),
    INDEX `TaskAttachment_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`),
    CONSTRAINT `TaskAttachment_taskId_fkey`
        FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `TaskAttachment_uploadedById_fkey`
        FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
