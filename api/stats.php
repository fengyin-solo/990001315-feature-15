<?php
/**
 * 时间区间对比统计 API
 * 提供今天、近七天、自定义区间的新增/通过/拒绝数据对比
 */
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../config/database.php';

header('Content-Type: application/json; charset=utf-8');

// 异常变化阈值（百分比），超过此值视为异常
define('ABNORMAL_THRESHOLD', 50);
// 自定义区间最大天数
define('MAX_RANGE_DAYS', 90);

$range = $_GET['range'] ?? 'today';
$customStart = trim($_GET['start'] ?? '');
$customEnd = trim($_GET['end'] ?? '');

try {
    $today = new DateTime('today');

    // 解析当前区间
    switch ($range) {
        case 'today':
            $currentStart = clone $today;
            $currentEnd = clone $today;
            break;

        case 'week':
            $currentStart = (clone $today)->modify('-6 days');
            $currentEnd = clone $today;
            break;

        case 'custom':
            $currentStart = DateTime::createFromFormat('Y-m-d', $customStart);
            $currentEnd = DateTime::createFromFormat('Y-m-d', $customEnd);

            // 验证日期格式
            if (!$currentStart || $currentStart->format('Y-m-d') !== $customStart) {
                jsonResponse(1, '开始日期格式不正确');
            }
            if (!$currentEnd || $currentEnd->format('Y-m-d') !== $customEnd) {
                jsonResponse(1, '结束日期格式不正确');
            }
            if ($currentStart > $currentEnd) {
                jsonResponse(1, '开始日期不能晚于结束日期');
            }
            if ($currentEnd > $today) {
                jsonResponse(1, '结束日期不能晚于今天');
            }

            // 验证区间大小
            $days = $currentStart->diff($currentEnd)->days + 1;
            if ($days > MAX_RANGE_DAYS) {
                jsonResponse(2, '查询区间过大，请选择 ' . MAX_RANGE_DAYS . ' 天以内的区间', [
                    'incomplete' => ['current', 'previous']
                ]);
            }
            break;

        default:
            jsonResponse(1, '未知的时间区间类型');
    }

    // 计算上一周期（等长，紧接当前区间之前）
    $days = $currentStart->diff($currentEnd)->days + 1;
    $previousEnd = (clone $currentStart)->modify('-1 day');
    $previousStart = (clone $previousEnd)->modify('-' . ($days - 1) . ' days');

    // 查询当前区间数据
    $current = getMessageRangeStats(
        $currentStart->format('Y-m-d'),
        $currentEnd->format('Y-m-d')
    );

    // 查询上一区间数据
    $previous = getMessageRangeStats(
        $previousStart->format('Y-m-d'),
        $previousEnd->format('Y-m-d')
    );

    // 计算变化率和异常标记
    $changes = [];
    $warnings = [];
    $incomplete = [];

    foreach (['new', 'approved', 'rejected'] as $key) {
        $curr = $current[$key];
        $prev = $previous[$key];
        $diff = $curr - $prev;
        $percent = null;
        $noHistory = false;
        $abnormal = false;

        if ($prev === 0) {
            if ($curr === 0) {
                // 两周期都无数据，变化为 0
                $percent = 0;
            } else {
                // 上一周期无数据，无法计算变化率
                $noHistory = true;
                $warnings[] = '上一周期无' . getMetricLabel($key) . '数据，无法计算变化率';
                // 从无到有视为异常（新增爆发）
                $abnormal = true;
            }
        } else {
            $percent = round(($diff / $prev) * 100, 1);
            // 变化幅度超过阈值视为异常
            if (abs($percent) >= ABNORMAL_THRESHOLD) {
                $abnormal = true;
            }
        }

        $changes[$key] = [
            'value' => $diff,
            'percent' => $percent,
            'abnormal' => $abnormal,
            'no_history' => $noHistory
        ];
    }

    // 检查是否有历史数据缺失
    if ($previous['new'] === 0 && $previous['approved'] === 0 && $previous['rejected'] === 0) {
        $incomplete[] = 'previous';
        $warnings[] = '上一周期缺少历史数据，对比结果仅供参考';
    }

    jsonResponse(0, 'ok', [
        'range' => $range,
        'current' => array_merge($current, [
            'start' => $currentStart->format('Y-m-d'),
            'end' => $currentEnd->format('Y-m-d'),
            'days' => $days
        ]),
        'previous' => array_merge($previous, [
            'start' => $previousStart->format('Y-m-d'),
            'end' => $previousEnd->format('Y-m-d'),
            'days' => $days
        ]),
        'changes' => $changes,
        'warnings' => $warnings,
        'incomplete' => $incomplete,
        'threshold' => ABNORMAL_THRESHOLD
    ]);

} catch (PDOException $e) {
    // 数据库异常
    error_log('Stats API error: ' . $e->getMessage());
    jsonResponse(3, '统计计算异常，请稍后重试', [
        'incomplete' => ['current', 'previous']
    ]);
} catch (Exception $e) {
    // 其他异常
    error_log('Stats API error: ' . $e->getMessage());
    jsonResponse(3, '统计计算异常，请稍后重试', [
        'incomplete' => ['current', 'previous']
    ]);
}
