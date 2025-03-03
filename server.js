require("dotenv").config();
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const Minio = require("minio");
const fs = require("fs");
const path = require("path");

const packageDefinition = protoLoader.loadSync("protos/storage.proto");
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;

// Set up MinIO clients for each node
const minioClients = [
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_1.split(":")[0],
    port: parseInt(process.env.MINIO_ENDPOINT_1.split(":")[1]),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: false,
  }),
];

// Upload file to MinIO
async function uploadFile(call, callback) {
  const chunks = [];
  call.on("data", (chunk) => chunks.push(chunk.fileData));
  call.on("end", async () => {
    const buffer = Buffer.concat(chunks);
    const fileName = call.metadata.get("fileName")[0];

    // Store file in MinIO
    const client = minioClients[0];
    await client.putObject("files", fileName, buffer);
    callback(null, { message: `File ${fileName} uploaded successfully` });
  });
}

// Download file from MinIO
function downloadFile(call) {
  const { fileName } = call.request;
  const client = minioClients[0];

  client.getObject("files", fileName, (err, stream) => {
    if (err) return call.emit("error", err);
    stream.on("data", (chunk) => call.write({ fileData: chunk }));
    stream.on("end", () => call.end());
  });
}

// Get metadata of a file from MinIO
async function getMetadata(call, callback) {
  const { fileName } = call.request;
  const client = minioClients[0];

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

async function main() {
  const client = minioClients[0];

  // Create the bucket if it doesn't exist
  const bucketName = "files";
  const bucketExists = await client.bucketExists(bucketName);
  if (!bucketExists) {
    await client.makeBucket(bucketName, "us-east-1");
    console.log(`Bucket ${bucketName} created successfully`);
  }

  const server = new grpc.Server();
  server.addService(storageProto.service, { uploadFile, downloadFile, getMetadata });
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