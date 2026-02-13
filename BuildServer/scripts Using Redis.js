import { spawn } from "child_process";
import mime from "mime-types";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import Redis from "ioredis";

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;
const REDIS_URL = process.env.REDIS_URL;
const S3_BUCKET = process.env.S3_BUCKET;

if (!PROJECT_ID) {
  console.error("❌ PROJECT_ID not set");
  process.exit(1);
}

const publisher = new Redis(REDIS_URL);
publisher.on("error", (err) => {
  console.error("Redis error:", err.message);
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION, // ECS Task Role will be used
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

function publishLog(log) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function uploadToS3(outpath) {
  publishLog("Upload started");

  const distfolderpath = path.join(outpath, "dist");

  if (!fs.existsSync(distfolderpath)) {
    throw new Error(`❌ dist folder not found at ${distfolderpath}`);
  }

  const files = fs.readdirSync(distfolderpath, { recursive: true });

  for (const file of files) {
    const fullPath = path.join(distfolderpath, file);
    if (fs.lstatSync(fullPath).isDirectory()) continue;

    const s3Key = path
      .join("__outputs", PROJECT_ID, file)
      .replace(/\\/g, "/");

    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: fs.createReadStream(fullPath),
        ContentType: mime.lookup(fullPath) || "application/octet-stream",
      })
    );

    console.log(`✅ Uploaded: ${file}`);
  }

  publishLog("Upload completed");
}

async function runBuild(outpath) {
  return new Promise((resolve, reject) => {
    const child = spawn(  // spawn is used to run a command in a new process
      "npm",
      ["ci", "--no-fund", "--no-audit"], // ci is used to install dependencies from package-lock.json
      { cwd: outpath, stdio: "inherit" } // cwd is used to set the current working directory and inherit is used to show the output in the console
    );

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`npm ci failed with code ${code}`));
        return;
      }

      const build = spawn(
        "npm",
        ["run", "build"],
        { cwd: outpath, stdio: "inherit" }
      );

      build.on("close", (code) => { // listen for the close event to know when the process is done
        if (code !== 0) {
          reject(new Error(`npm run build failed with code ${code}`));
        } else {
          resolve();
        }
      });
    });
  });
}

async function init() {
  try {
    publishLog("🚀 Build started");

    const outpath = path.join(__dirname, "output");

    await runBuild(outpath);

    publishLog("🎉 Build completed");

    await uploadToS3(outpath);

    publishLog("🎉 Done");
    process.exit(0); // means exit successfully
  } catch (err) {
    console.error("❌ Error:", err.message);
    publishLog(`❌ Error: ${err.message}`);
    process.exit(1);
  }
}

init();



