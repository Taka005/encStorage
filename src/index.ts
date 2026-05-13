import AdminZip from "adm-zip";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { getHash } from "./utils/getHash";

const { values } = parseArgs({
  args: process.argv,
  options: {
    password: {
      type: "string",
      short: "p",
    },
    targetDir: {
      type: "string",
      short: "t",
    }
  },
  strict: true,
  allowPositionals: false
});

const { password, targetDir } = values;

if (!password || !targetDir) {
  console.error("Usage: bun run src/index.ts -p <password> -t <targetDir>");
  process.exit(1);
}

const passwordBuffer = Buffer.from(password);

const hashedDirName = getHash(targetDir);

fs.mkdirSync(path.join(__dirname, hashedDirName),{
  recursive: true
});

const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(passwordBuffer, salt, 100000, 32, "sha256");

const targetFiles: string[] = fs.readdirSync(targetDir, { encoding: "utf8" })
  .filter(file => !fs.statSync(path.join(targetDir, file)).isFile())
  .sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  }));

const manifest = {};

console.log(`Processing ${targetFiles.length} files...`);