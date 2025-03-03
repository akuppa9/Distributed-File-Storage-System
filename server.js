require("dotenv").config();
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const Minio = require("minio");
const fs = require("fs");
const path = require("path");

const packageDefinition = protoLoader.loadSync("protos/storage.proto");
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;

// Set up MinIO clients for distributed storage
const minioClients = [
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_1.split(":")[0],
    port: parseInt(process.env.MINIO_ENDPOINT_1.split(":")[1]),
    accessKey: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY,
    useSSL: false,
  }),
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_2.split(":")[0],
    port: parseInt(process.env.MINIO_ENDPOINT_2.split(":")[1]),
    accessKey: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY,
    useSSL: false,
  }),
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_3.split(":")[0],
    port: parseInt(process.env.MINIO_ENDPOINT_3.split(":")[1]),
    accessKey: process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY,
    useSSL: false,
  }),
];

async function ensureBucketExists() {
  const bucketName = "files";
  for (const client of minioClients) {
    const bucketExists = await client.bucketExists(bucketName);
    if (!bucketExists) {
      await client.makeBucket(bucketName, "us-east-1");
      console.log(
        `Bucket ${bucketName} created successfully on ${client.host}:${client.port}`
      );
    }
  }
}

async function uploadFile(call, callback) {
  const chunks = [];
  call.on("data", (chunk) => chunks.push(chunk.fileData));
  call.on("end", async () => {
    const buffer = Buffer.concat(chunks);
    const fileName = call.metadata.get("fileName")[0];

    // Replicate file across all storage nodes
    const promises = minioClients.map((client) =>
      client.putObject("files", fileName, buffer)
    );

    try {
      await Promise.all(promises);
      callback(null, {
        message: `File ${fileName} uploaded successfully`,
      });
    } catch (err) {
      callback(err);
    }
  });
}

// Round-robin load balancing for read operations
let currentClientIndex = 0;

function getNextClient() {
  const client = minioClients[currentClientIndex];
  currentClientIndex = (currentClientIndex + 1) % minioClients.length;
  return client;
}

function downloadFile(call) {
  const { fileName } = call.request;
  const client = getNextClient();

  client.getObject("files", fileName, (err, stream) => {
    if (err) return call.emit("error", err);
    stream.on("data", (chunk) => call.write({ fileData: chunk }));
    stream.on("end", () => call.end());
  });
}

async function getMetadata(call, callback) {
  const { fileName } = call.request;
  const client = getNextClient();

  try {
    const stat = await client.statObject("files", fileName);
    const metadata = {
      fileName: fileName,
      uploadTime: stat.lastModified.toISOString(),
      version: stat.etag,
    };
    callback(null, metadata);
  } catch (err) {
    callback(err);
  }
}

async function listFiles(call, callback) {
  const client = getNextClient();
  const bucketName = "files";

  try {
    const fileStream = client.listObjects(bucketName, "", true);
    const fileList = { files: [] };
    const objectsList = [];

    fileStream.on("data", (obj) => {
      objectsList.push(obj.name);
    });

    fileStream.on("error", (err) => {
      console.error("Error listing files:", err);
      callback(err);
    });

    fileStream.on("end", () => {
      fileList.files = objectsList;
      callback(null, fileList);
    });
  } catch (err) {
    console.error("Error in listFiles:", err);
    callback(err);
  }
}

async function deleteFile(call, callback) {
  const { fileName } = call.request;

  try {
    // Delete file from all storage nodes
    const promises = minioClients.map((client) =>
      client.removeObject("files", fileName)
    );

    await Promise.all(promises);
    callback(null, {
      message: `File ${fileName} deleted successfully`,
    });
  } catch (err) {
    console.error("Error in deleteFile:", err);
    callback(err);
  }
}

async function main() {
  await ensureBucketExists();

  const server = new grpc.Server();
  server.addService(storageProto.service, {
    uploadFile,
    downloadFile,
    getMetadata,
    listFiles,
    deleteFile,
  });
  server.bindAsync(
    "0.0.0.0:5001",
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`gRPC server running on port ${port}`);
    }
  );
}

main();
