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

const outputDir = path.join(__dirname, getHash(targetDir));

fs.mkdirSync(outputDir,{ recursive: true });

const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(passwordBuffer, salt, 100000, 32, "sha256");

const targetFiles: string[] = fs.readdirSync(targetDir, { encoding: "utf8" })
  .filter(file => !fs.statSync(path.join(targetDir, file)).isFile())
  .sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  }));

const manifest: Record<string, { name: string; start: number; size: number; iv: string; tag: string }[]> = {};

console.log(`Processing ${targetFiles.length} files...`);

targetFiles.forEach((fileName,i)=>{
  const filePath = path.join(targetDir, fileName);

  const sequence = String(i).padStart(3, "0");
  const outputFileName = `${getHash(fileName)}_${sequence}`;

  const zip = new AdminZip(filePath);
  const entries = zip.getEntries()
    .filter(entry => !entry.isDirectory)
    .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined,{
      numeric: true,
      sensitivity: "base"
    }));

  let offset = 0;
  let fileIndex: { name: string; start: number; size: number; iv: string; tag: string }[] = [];
  let dataChunks: Buffer[] = [];

  entries.forEach(entry=>{
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    const encData = Buffer.concat([cipher.update(entry.getData()), cipher.final()]);
    const tag = cipher.getAuthTag();

    fileIndex.push({
      name: path.basename(entry.entryName),
      start: offset,
      size: encData.length,
      iv: iv.toString("hex"),
      tag: tag.toString("hex")
    });

    dataChunks.push(encData);
    offset += encData.length;
  });

  fs.writeFileSync(path.join(outputDir, outputFileName), Buffer.concat(dataChunks));

  manifest[outputFileName] = fileIndex;

  console.log(`[${sequence}] Done: ${fileName} -> ${outputFileName}(${entries.length} files, ${offset} bytes)`);
});

const manifestIv = crypto.randomBytes(12);
const manifestCipher = crypto.createCipheriv("aes-256-gcm", key, manifestIv);
const manifestEncData = Buffer.concat([manifestCipher.update(JSON.stringify(manifest)), manifestCipher.final()]);
const manifestTag = manifestCipher.getAuthTag();

const manifestData = Buffer.concat([
  salt,
  manifestIv,
  manifestTag,
  manifestEncData
]);

fs.writeFileSync(path.join(outputDir, "manifest"), manifestData);

console.log(`All done! processed ${targetFiles.length} files`);