<?php
$storageDir = "/home/taka/storage";

$dirs = glob($storageDir . "/*", GLOB_ONLYDIR);

$dirNames = array_map("basename", $dirs);

header("Content-Type: application/json");
echo json_encode($dirNames);