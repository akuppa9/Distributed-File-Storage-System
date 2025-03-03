const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs');

const packageDefinition = protoLoader.loadSync('protos/storage.proto');
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;
const client = new storageProto('localhost:5000', grpc.credentials.createInsecure());

function uploadFile(filePath) {
  const call = client.uploadFile();
  const fileName = filePath.split('/').pop();
  const stream = fs.createReadStream(filePath);

  stream.on('data', (chunk) => call.write({ fileData: chunk }));
  stream.on('end', () => call.end());
  call.on('data', (response) => console.log(response.message));
}

function downloadFile(fileName) {
  const call = client.downloadFile({ fileName });
  const writeStream = fs.createWriteStream(`downloaded_${fileName}`);

  call.on('data', (chunk) => writeStream.write(chunk.fileData));
  call.on('end', () => console.log(`Downloaded ${fileName}`));
}

uploadFile('test.txt');  // Example usage