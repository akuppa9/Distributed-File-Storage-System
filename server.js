require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Minio = require('minio');
const fs = require('fs');
const path = require('path');

const packageDefinition = protoLoader.loadSync('protos/storage.proto');
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;

// Set up MinIO clients for each node
const minioClients = [
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT_1.split(':')[0],
    port: parseInt(process.env.MINIO_ENDPOINT_1.split(':')[1]),
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    useSSL: false,
  })
];

// Upload file to MinIO
async function uploadFile(call, callback) {
  const chunks = [];
  call.on('data', (chunk) => chunks.push(chunk.fileData));
  call.on('end', async () => {
    const buffer = Buffer.concat(chunks);
    const fileName = call.metadata.get('fileName')[0];

    // Store file in MinIO
    const client = minioClients[0];
    await client.putObject('files', fileName, buffer);
    callback(null, { message: `File ${fileName} uploaded successfully` });
  });
}

// Download file from MinIO
function downloadFile(call) {
  const { fileName } = call.request;
  const client = minioClients[0];

  client.getObject('files', fileName, (err, stream) => {
    if (err) return call.emit('error', err);
    stream.on('data', (chunk) => call.write({ fileData: chunk }));
    stream.on('end', () => call.end());
  });
}

function main() {
  const server = new grpc.Server();
  server.addService(storageProto.FileStorage.service, { uploadFile, downloadFile });
  server.bindAsync('0.0.0.0:5000', grpc.ServerCredentials.createInsecure(), () => {
    console.log('gRPC server running on port 5000');
    server.start();
  });
}

main();