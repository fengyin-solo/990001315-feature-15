-- 审核时间字段迁移脚本
-- 执行此 SQL 来添加审核时间字段，用于准确统计通过/拒绝的时间区间数据

USE `community_board`;

-- 添加审核时间字段
ALTER TABLE `messages`
ADD COLUMN `audited_at` DATETIME DEFAULT NULL COMMENT '审核时间' AFTER `status`,
ADD INDEX `idx_audited` (`audited_at`);

-- 初始化已有数据的审核时间（使用更新时间近似）
UPDATE `messages` SET `audited_at` = `updated_at` WHERE `status` IN (1, 2) AND `audited_at` IS NULL;

-- 执行完成后，可以通过以下命令验证：
-- DESCRIBE messages;
-- SELECT id, status, audited_at FROM messages LIMIT 5;
