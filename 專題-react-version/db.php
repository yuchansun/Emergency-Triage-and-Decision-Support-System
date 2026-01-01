<?php
// 本機 XAMPP 環境用的固定資料庫連線設定
$servername = "localhost";
$username   = "root";
$password   = "";          // 若你有替 XAMPP MySQL 設定密碼，請改這裡
$dbname     = "triage"; // 你在 phpMyAdmin 建的資料庫名稱

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die("資料庫連線失敗: " . $conn->connect_error);
}

// 設定編碼避免中文亂碼
$conn->set_charset("utf8mb4");
