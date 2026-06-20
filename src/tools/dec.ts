import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseArgs } from "util";

const { values } = parseArgs({
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
  console.error("Usage: bun run src/tool/dec.ts -p <password> -t <targetDir>");
  process.exit(1);
}

const passwordBuffer = Buffer.from(password);

const manifestPath = path.join(targetDir, "manifest");

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

const manifest: {
  originalDirName: string;
  files: {
    fileName: string;
    originalFileName: string;
    contents: { name: string; start: number; size: number; iv: string; tag: string }[]
  }[]
} = JSON.parse(decManifestRaw);

console.log(`Manifest loaded. Processing ${manifest.files.length} files...`);

const outputDir = `./restored/${manifest.originalDirName}`;

fs.mkdirSync(outputDir,{ recursive: true });

manifest.files.forEach(({ fileName, originalFileName, contents })=>{
  const encFilePath = path.join(targetDir, fileName);
  const encBlob = fs.readFileSync(encFilePath);

  contents.forEach((content)=>{
    const fileData = encBlob.subarray(content.start, content.start + content.size);

    const iv = Buffer.from(content.iv, "hex");
    const tag = Buffer.from(content.tag, "hex");

    const fileDecipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    fileDecipher.setAuthTag(tag);

    const decFileData = Buffer.concat([
      fileDecipher.update(fileData),
      fileDecipher.final()
    ]);

    const fileOutputPath = path.join(outputDir, originalFileName);

    fs.mkdirSync(fileOutputPath,{ recursive: true });
    fs.writeFileSync(path.join(fileOutputPath, content.name), decFileData);
  });

   console.log(`Restored: ${fileName} -> ${originalFileName} (${contents.length} files)`);
});

console.log("All Done!");