<?php
$storageDir = "/home/taka/storage";
$manifests = [];

if (is_dir($storageDir)) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($storageDir));
    foreach ($iterator as $file) {
        if ($file->getFilename() === "manifest") {
            $relativePath = str_replace($storageDir . DIRECTORY_SEPARATOR, "", $file->getPathname());
            $manifests[] = str_replace("\\", "/", $relativePath);
        }
    }
}

header("Content-Type: application/json");
echo json_encode($manifests);