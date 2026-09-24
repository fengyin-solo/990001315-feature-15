-- 留言审核流水迁移脚本
-- 为首页“时间区间对比”提供通过/拒绝数量的精确审核时间口径。
-- 注意：messages.updated_at 会被浏览量更新刷新，不能作为审核时间，
--       因此新增状态流水表记录每一次审核动作。

USE `community_board`;

-- 应用键值元数据
CREATE TABLE IF NOT EXISTS `app_meta` (
    `meta_key` VARCHAR(64) NOT NULL PRIMARY KEY,
    `meta_value` VARCHAR(255) NOT NULL,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用键值元数据';

-- 留言审核状态流水（不加外键，留言删除后流水仍保留用于区间统计）
CREATE TABLE IF NOT EXISTS `message_status_logs` (
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `message_id` INT UNSIGNED NOT NULL COMMENT '留言ID（留言删除后仍保留流水）',
    `from_status` TINYINT DEFAULT NULL COMMENT '原状态: 0待审核, 1已通过, 2已拒绝',
    `to_status` TINYINT NOT NULL COMMENT '新状态: 1已通过, 2已拒绝',
    `admin_id` INT UNSIGNED DEFAULT NULL COMMENT '操作管理员ID',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审核动作时间',
    INDEX `idx_status_time` (`to_status`, `created_at`),
    INDEX `idx_message_id` (`message_id`),
    INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言审核状态流水';

-- 历史数据回填：以 updated_at 估算存量留言的审核时间（只执行一次）
INSERT INTO `message_status_logs` (`message_id`, `from_status`, `to_status`, `admin_id`, `created_at`)
SELECT `id`, 0, `status`, NULL, `updated_at`
FROM `messages`
WHERE `status` IN (1, 2)
  AND `updated_at` IS NOT NULL
  AND `id` NOT IN (SELECT DISTINCT `message_id` FROM `message_status_logs`);

-- 记录基线时间：此前的通过/拒绝统计含估算成分，接口会在响应中标记
INSERT IGNORE INTO `app_meta` (`meta_key`, `meta_value`)
VALUES ('audit_log_baseline', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s'));

-- 验证：
-- SELECT to_status, COUNT(*) FROM message_status_logs GROUP BY to_status;
-- SELECT * FROM app_meta WHERE meta_key = 'audit_log_baseline';
