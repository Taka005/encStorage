import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseArgs } from "util";

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

const encDir = path.join(__dirname, targetDir);
const manifestPath = path.join(encDir, "manifest");

if (!fs.existsSync(manifestPath)) throw new Error("Manifest file is not found");

const manifestBuffer = fs.readFileSync(manifestPath);

const salt = manifestBuffer.subarray(0, 16);
const manifestIv = manifestBuffer.subarray(16, 28);
const manifestTag = manifestBuffer.subarray(28, 44);
const manifestEncData = manifestBuffer.subarray(44);

const key = crypto.pbkdf2Sync(passwordBuffer, salt, 100000, 32, "sha256");

const manifestDecipher = crypto.createDecipheriv("aes-256-gcm", key, manifestIv);
manifestDecipher.setAuthTag(manifestTag);

const decManifestRaw = Buffer.concat([
  manifestDecipher.update(manifestEncData),
  manifestDecipher.final()
]).toString("utf-8");

const manifest: Record<string, { name: string; start: number; size: number; iv: string; tag: string }[]> = JSON.parse(decManifestRaw);

console.log(`Manifest loaded. Processing ${Object.keys(manifest).length} files...`);

const outputDir = path.join(__dirname, "restored");

fs.mkdirSync(outputDir,{ recursive: true });

for (const [fileName, files] of Object.entries(manifest)){
  const encFilePath = path.join(outputDir, fileName);
  const encBlob = fs.readFileSync(encFilePath);

  files.forEach((file)=>{
    const fileData = encBlob.subarray(file.start, file.start + file.size);

    const iv = Buffer.from(file.iv, "hex");
    const tag = Buffer.from(file.tag, "hex");

    const Filedecipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    Filedecipher.setAuthTag(tag);

    const decFileData = Buffer.concat([
      Filedecipher.update(fileData),
      Filedecipher.final()
    ]);

    const fileOutputPath = path.join(outputDir, file.name);

    fs.writeFileSync(fileOutputPath, decFileData);

    console.log(`Restored: ${fileOutputPath}`);
  });
}

console.log("All Done!");