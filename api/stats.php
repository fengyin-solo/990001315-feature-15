<?php
/**
 * 区间统计接口
 * GET api/stats.php?range=today|7d|custom&start=Y-m-d&end=Y-m-d
 *
 * 缺少历史数据、区间过大或计算异常时以非 0 code 返回，
 * 由前端保留上次结果并标出未完成区间。
 */
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/stats.php';

header('Content-Type: application/json; charset=utf-8');

$range = $_GET['range'] ?? 'today';
$start = $_GET['start'] ?? null;
$end = $_GET['end'] ?? null;

try {
    $db = getDB();

    if (!ensureStatsSchema($db)) {
        jsonResponse(500, '统计数据暂时不可用，已保留上次结果');
    }

    $resolved = resolveStatsPeriod($range, $start, $end);
    if ($resolved === null) {
        // 参数缺失、区间非法或区间过大：不覆盖前端已有结果
        jsonResponse(1, '时间区间无效或超过' . STATS_MAX_RANGE_DAYS . '天上限，已保留上次结果');
    }

    [$current, $previous, $incomplete] = $resolved;
    $baseline = getAuditBaseline($db);

    $currentMetrics = getPeriodMetrics($db, $current, $baseline);
    $previousMetrics = getPeriodMetrics($db, $previous, $baseline);

    // 上一区间早于留言板最早数据（含建板前区间），视为缺少历史数据，环比不展示
    $earliestStmt = $db->query("SELECT MIN(created_at) FROM messages");
    $earliest = $earliestStmt->fetchColumn();
    $previousAvailable = $earliest !== null && $previous['end'] >= $earliest;

    $metrics = [];
    foreach (['new', 'approved', 'rejected'] as $metric) {
        $metrics[$metric] = [
            'current' => $currentMetrics[$metric],
            'previous' => $previousAvailable ? $previousMetrics[$metric] : null,
            'change' => buildMetricChange(
                $currentMetrics[$metric],
                $previousMetrics[$metric],
                $previousAvailable
            ),
        ];
    }

    // 任一指标触发异常即给出整体异常提示
    $anomalyList = [];
    $labels = ['new' => '新增', 'approved' => '通过', 'rejected' => '被拒绝'];
    foreach ($metrics as $key => $m) {
        if ($m['change']['anomaly']) {
            $change = $m['change'];
            if ($m['current'] == 0 && $m['previous'] > 0) {
                $anomalyList[] = $labels[$key] . '数量由上期 ' . $m['previous'] . ' 降为 0';
            } else {
                $anomalyList[] = $labels[$key] . '数量较上期异常增加（' . $m['previous'] . ' → ' . $m['current'] . '）';
            }
        }
    }

    jsonResponse(0, 'ok', [
        'range' => $range,
        'current' => [
            'start' => $current['start'],
            'end' => $current['end'],
            'label' => $current['label'],
            'metrics' => $metrics,
        ],
        'previous' => [
            'start' => $previous['start'],
            'end' => $previous['end'],
            'available' => $previousAvailable,
        ],
        // 今天/含今天的自定义区间：本期尚未结束
        'incomplete' => $incomplete,
        // 审核流水上线前的数据由 updated_at 估算
        'estimated' => $currentMetrics['estimated'],
        'anomalies' => $anomalyList,
    ]);
} catch (Throwable $e) {
    error_log('stats api error: ' . $e->getMessage());
    jsonResponse(500, '统计计算异常，已保留上次结果');
}
