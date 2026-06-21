import crypto from "crypto";
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { open } from "yauzl-promise";
import { getHash } from "./utils/getHash";

const { values } = parseArgs({
  options: {
    password: { type: "string", short: "p" },
    targetDir: { type: "string", short: "t" }
  },
  strict: true,
  allowPositionals: false
});

const { password, targetDir } = values;

if (!password || !targetDir) {
  console.error("Usage: bun run src/tool/enc.ts -p <password> -t <targetDir>");
  process.exit(1);
}

const passwordBuffer = Buffer.from(password);
const outputDir = getHash(targetDir);
fs.mkdirSync(outputDir, { recursive: true });

const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(passwordBuffer, salt, 100000, 32, "sha256");

const targetFiles = fs.readdirSync(targetDir, { encoding: "utf8" })
  .filter(file => fs.statSync(path.join(targetDir, file)).isFile())
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

const manifest = {
  originalDirName: targetDir,
  files: [] as {
    fileName: string;
    originalFileName: string;
    contents: { name: string; start: number; size: number; iv: string; tag: string }[]
  }[]
};

async function processFiles(targetDir: string) {
  console.log(`Processing ${targetFiles.length} files...`);

  for (const [i, fileName] of targetFiles.entries()) {
    const filePath = path.join(targetDir, fileName);
    const outputFileName = `${getHash(fileName)}`;

    const zip = await open(filePath);
    const fileIndex: { name: string; start: number; size: number; iv: string; tag: string }[] = [];
    let dataChunks: Buffer[] = [];
    let offset = 0;

    try {
      for await (const entry of zip) {
        if (!/\.(jpg|jpeg|png|gif|bmp|webp|avif|tiff|svg)$/i.test(entry.filename)) continue;

        const stream = await entry.openReadStream();
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(chunk);
        const data = Buffer.concat(chunks);

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const encData = Buffer.concat([cipher.update(data), cipher.final()]);
        const tag = cipher.getAuthTag();

        fileIndex.push({
          name: path.basename(entry.filename),
          start: offset,
          size: encData.length,
          iv: iv.toString("hex"),
          tag: tag.toString("hex")
        });

        dataChunks.push(encData);
        offset += encData.length;
      }

      fs.writeFileSync(path.join(outputDir, outputFileName), Buffer.concat(dataChunks));

      manifest.files.push({
        fileName: outputFileName,
        originalFileName: fileName,
        contents: fileIndex
      });

      console.log(`Done: ${fileName} -> ${outputFileName} (${fileIndex.length} files, ${offset} bytes)`);
    } finally {
      await zip.close();
    }
  }

  const manifestIv = crypto.randomBytes(12);
  const manifestCipher = crypto.createCipheriv("aes-256-gcm", key, manifestIv);
  const manifestEncData = Buffer.concat([manifestCipher.update(JSON.stringify(manifest)), manifestCipher.final()]);
  const manifestTag = manifestCipher.getAuthTag();
  const manifestData = Buffer.concat([salt, manifestIv, manifestTag, manifestEncData]);

  fs.writeFileSync(path.join(outputDir, "manifest"), manifestData);
  console.log(`All done! processed ${targetFiles.length} files`);
}

processFiles(targetDir).catch(console.error);