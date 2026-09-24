<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '123456');
define('DB_NAME', 'community_board');
define('DB_CHARSET', 'utf8mb4');

function getDB() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
            // 与 includes/stats.php 的 PHP 时区保持一致，
            // 保证区间边界字符串与 created_at/NOW() 按同一时区比较
            date_default_timezone_set('Asia/Shanghai');
            try {
                $pdo->exec("SET time_zone = '+08:00'");
            } catch (PDOException $e) {
                // MySQL 未导入时区表时忽略，按服务器默认时区处理
            }
        } catch (PDOException $e) {
            die(json_encode(['code' => 500, 'msg' => '数据库连接失败']));
        }
    }
    return $pdo;
}
