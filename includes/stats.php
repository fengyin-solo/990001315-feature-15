<?php
/**
 * 留言统计统一口径模块
 *
 * 所有统计（首页总览、区间趋势对比、后台处理数量）都必须经过本文件，
 * 保证“同一口径、同一范围、同一标准”：
 *  - 新增：messages.created_at 落在区间内的留言（含待审核/已通过/已拒绝，删除即不计）
 *  - 通过/拒绝：message_status_logs.created_at 落在区间内的审核动作
 *  - 总览（首页四个卡片/后台计数）：以 messages.status 当前状态为准
 */

date_default_timezone_set('Asia/Shanghai');

// 自定义区间允许的最大天数（区间过大时拒绝计算并保留上次结果）
if (!defined('STATS_MAX_RANGE_DAYS')) {
    define('STATS_MAX_RANGE_DAYS', 366);
}

// 异常变化判定阈值：变化量绝对值 >= 该值 且 环比增幅 >= 100%
if (!defined('STATS_ANOMALY_DELTA')) {
    define('STATS_ANOMALY_DELTA', 10);
}
if (!defined('STATS_ANOMALY_RATIO')) {
    define('STATS_ANOMALY_RATIO', 1.0);
}

/**
 * 确保统计所需的表存在（幂等）。
 * 失败时静默返回 false，调用方按“计算异常”处理。
 */
function ensureStatsSchema(PDO $db) {
    static $checked = null;
    if ($checked !== null) return $checked;
    try {
        $db->exec("CREATE TABLE IF NOT EXISTS `app_meta` (
            `meta_key` VARCHAR(64) NOT NULL PRIMARY KEY,
            `meta_value` VARCHAR(255) NOT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='应用键值元数据'");

        $db->exec("CREATE TABLE IF NOT EXISTS `message_status_logs` (
            `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            `message_id` INT UNSIGNED NOT NULL COMMENT '留言ID（留言删除后仍保留流水）',
            `from_status` TINYINT DEFAULT NULL COMMENT '原状态: 0待审核, 1已通过, 2已拒绝',
            `to_status` TINYINT NOT NULL COMMENT '新状态: 1已通过, 2已拒绝',
            `admin_id` INT UNSIGNED DEFAULT NULL COMMENT '操作管理员ID',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审核动作时间',
            INDEX `idx_status_time` (`to_status`, `created_at`),
            INDEX `idx_message_id` (`message_id`),
            INDEX `idx_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='留言审核状态流水'");

        // 一次性回填历史审核记录（以 updated_at 估算），完成后写入基线时间
        $stmt = $db->prepare("SELECT meta_value FROM app_meta WHERE meta_key = 'audit_log_baseline'");
        $stmt->execute();
        $baseline = $stmt->fetchColumn();

        if (!$baseline) {
            $db->exec("INSERT IGNORE INTO message_status_logs (message_id, from_status, to_status, admin_id, created_at)
                SELECT id, 0, status, NULL, updated_at
                FROM messages
                WHERE status IN (1, 2)
                  AND updated_at IS NOT NULL
                  AND id NOT IN (SELECT DISTINCT message_id FROM message_status_logs)");
            $db->prepare("INSERT IGNORE INTO app_meta (meta_key, meta_value) VALUES ('audit_log_baseline', ?)")
                ->execute([date('Y-m-d H:i:s')]);
        }

        $checked = true;
    } catch (Throwable $e) {
        $checked = false;
    }
    return $checked;
}

/**
 * 审核流水基线时间：此前的通过/拒绝数量由 updated_at 估算。
 * 返回 null 表示无精确审核历史（全部为估算）。
 */
function getAuditBaseline(PDO $db) {
    try {
        $stmt = $db->prepare("SELECT meta_value FROM app_meta WHERE meta_key = 'audit_log_baseline'");
        $stmt->execute();
        $v = $stmt->fetchColumn();
        return $v ?: null;
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * 首页/后台总览：全部留言及各分类数量，仅统计当前已通过的留言。
 * 首页四个卡片、分类入口、后台处理结果共用此口径。
 */
function getOverviewStats(PDO $db) {
    $stmt = $db->query("SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN type='help' THEN 1 ELSE 0 END) AS help_count,
        SUM(CASE WHEN type='suggest' THEN 1 ELSE 0 END) AS suggest_count,
        SUM(CASE WHEN type='lost' THEN 1 ELSE 0 END) AS lost_count
        FROM messages WHERE status = 1");
    $row = $stmt->fetch() ?: [];
    return [
        'total' => (int)($row['total'] ?? 0),
        'help_count' => (int)($row['help_count'] ?? 0),
        'suggest_count' => (int)($row['suggest_count'] ?? 0),
        'lost_count' => (int)($row['lost_count'] ?? 0),
    ];
}

/**
 * 解析区间参数，返回当前区间与等长上一区间。
 *
 * @param string $range today|7d|custom
 * @return array|null  [['start'=>dt, 'end'=>dt, 'label'=>..], [..prev..], incomplete] 或 null（参数非法/区间过大）
 */
function resolveStatsPeriod($range, $startDate = null, $endDate = null) {
    $today = new DateTimeImmutable('today'); // 今天 00:00
    $now = new DateTimeImmutable();

    if ($range === 'today') {
        $start = $today;
        $end = $now; // 今天尚未结束
        $label = '今天';
    } elseif ($range === '7d') {
        $start = $today->modify('-6 days'); // 含今天共7天
        $end = $now;
        $label = '近7天';
    } elseif ($range === 'custom') {
        if (!$startDate || !$endDate) return null;
        $s = DateTimeImmutable::createFromFormat('Y-m-d', $startDate);
        $e = DateTimeImmutable::createFromFormat('Y-m-d', $endDate);
        if (!$s || !$e || $s->format('Y-m-d') !== $startDate || $e->format('Y-m-d') !== $endDate) {
            return null;
        }
        $s = $s->setTime(0, 0, 0);
        if ($e->format('Y-m-d') === $today->format('Y-m-d')) {
            $eEnd = $now; // 结束日为今天，区间未结束
        } else {
            $eEnd = $e->setTime(23, 59, 59);
        }
        if ($s > $eEnd || $e > $today) return null; // 不支持未来区间
        if ($s->diff($e->setTime(0, 0, 0))->days + 1 > STATS_MAX_RANGE_DAYS) return null;
        $start = $s;
        $end = $eEnd;
        $label = $startDate . ' 至 ' . $endDate;
    } else {
        return null;
    }

    $length = $start->diff($end);
    $prevEnd = $start->modify('-1 second');
    $prevStart = $prevEnd->sub($length);

    // 结束时间为当前时间（今天/含今天的区间）属于未完成区间
    $incomplete = $end->format('Y-m-d H:i') === $now->format('Y-m-d H:i');

    return [[
        'start' => $start->format('Y-m-d H:i:s'),
        'end' => $end->format('Y-m-d H:i:s'),
        'label' => $label,
    ], [
        'start' => $prevStart->format('Y-m-d H:i:s'),
        'end' => $prevEnd->format('Y-m-d H:i:s'),
    ], $incomplete];
}

/**
 * 统计某区间内单个指标数量。
 *
 * @param string $metric new|approved|rejected
 * @return array ['count'=>int, 'estimated'=>bool]
 */
function countMetricInPeriod(PDO $db, $metric, $start, $end, $baseline) {
    if ($metric === 'new') {
        $stmt = $db->prepare("SELECT COUNT(*) FROM messages
            WHERE created_at >= ? AND created_at <= ?");
        $stmt->execute([$start, $end]);
        // 新增按创建时间统计，始终精确，不依赖审核流水
        return ['count' => (int)$stmt->fetchColumn(), 'estimated' => false];
    }

    $status = ($metric === 'approved') ? 1 : 2;
    $stmt = $db->prepare("SELECT COUNT(*) FROM message_status_logs
        WHERE to_status = ? AND created_at >= ? AND created_at <= ?");
    $stmt->execute([$status, $start, $end]);
    // 区间早于审核流水基线时，记录由 updated_at 回填估算
    $estimated = ($baseline === null) || ($start < $baseline);
    return ['count' => (int)$stmt->fetchColumn(), 'estimated' => $estimated];
}

/**
 * 计算环比变化与异常标记。
 * 异常：环比暴增（绝对增量与增幅同时超阈值）或暴降为 0（上期为正、本期为 0）。
 */
function buildMetricChange($current, $previous, $previousAvailable) {
    if (!$previousAvailable) {
        return ['diff' => null, 'percent' => null, 'anomaly' => false, 'direction' => 'none'];
    }
    $diff = $current - $previous;
    $percent = $previous > 0 ? round(($diff / $previous) * 100) : null;

    $spike = $diff >= STATS_ANOMALY_DELTA
        && $previous > 0
        && ($diff / $previous) >= STATS_ANOMALY_RATIO;
    $dropToZero = $previous > 0 && $current === 0;
    $anomaly = $spike || $dropToZero;

    return [
        'diff' => $diff,
        'percent' => $percent,
        'anomaly' => $anomaly,
        'direction' => $diff > 0 ? 'up' : ($diff < 0 ? 'down' : 'flat'),
    ];
}

/**
 * 获取一个区间的三项指标（新增/通过/拒绝）。
 */
function getPeriodMetrics(PDO $db, array $period, $baseline) {
    $new = countMetricInPeriod($db, 'new', $period['start'], $period['end'], $baseline);
    $approved = countMetricInPeriod($db, 'approved', $period['start'], $period['end'], $baseline);
    $rejected = countMetricInPeriod($db, 'rejected', $period['start'], $period['end'], $baseline);
    return [
        'new' => $new['count'],
        'approved' => $approved['count'],
        'rejected' => $rejected['count'],
        // 审核类数据是否含历史估算成分
        'estimated' => $approved['estimated'] || $rejected['estimated'],
    ];
}

/**
 * 记录一次审核动作（与状态更新放在同一事务中调用）。
 */
function logStatusChange(PDO $db, $messageId, $fromStatus, $toStatus, $adminId) {
    $stmt = $db->prepare("INSERT INTO message_status_logs
        (message_id, from_status, to_status, admin_id, created_at)
        VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([$messageId, $fromStatus, $toStatus, $adminId]);
}
