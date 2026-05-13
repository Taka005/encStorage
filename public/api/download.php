<?php
$fileRelativePath = $_GET["path"] ?? "";
$baseDir = "/home/taka/storage/";
$fullPath = realpath($baseDir . $fileRelativePath);

if (!$fullPath || strpos($fullPath, realpath($baseDir)) !== 0 || !is_file($fullPath)) {
    http_response_code(404);
    exit("File not found");
}

$size = filesize($fullPath);
$start = 0;
$end = $size - 1;

if (isset($_SERVER["HTTP_RANGE"])) {
    preg_match("/bytes=(\d+)-(\d+)?/", $_SERVER["HTTP_RANGE"], $matches);
    $start = intval($matches[1]);
    if (isset($matches[2])) $end = intval($matches[2]);

    header("HTTP/1.1 206 Partial Content");
    header("Content-Range: bytes $start-$end/$size");
    $size = $end - $start + 1;
}

header("Content-Type: application/octet-stream");
header("Content-Length: " . $size);

$fp = fopen($fullPath, "rb");
fseek($fp, $start);
echo fread($fp, $size);
fclose($fp);