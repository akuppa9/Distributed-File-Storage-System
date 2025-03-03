const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const fs = require("fs");

const packageDefinition = protoLoader.loadSync("protos/storage.proto");
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;
const client = new storageProto(
  "localhost:5001",
  grpc.credentials.createInsecure()
);

function uploadFile(filePath) {
  const fileName = filePath.split("/").pop();

  // Create metadata to pass fileName
  const metadata = new grpc.Metadata();
  metadata.set("fileName", fileName);

  // Provide callback to handle server response
  const call = client.uploadFile(metadata, (error, response) => {
    if (error) {
      console.error("Error uploading file:", error);
      return;
    }
    console.log(response.message);
  });

  // Check if file exists before trying to read it
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    call.end();
    return;
  }

  const stream = fs.createReadStream(filePath);

  stream.on("data", (chunk) => call.write({ fileData: chunk }));
  stream.on("error", (err) => {
    console.error("Error reading file:", err);
    call.end();
  });
  stream.on("end", () => call.end());
}

function downloadFile(fileName) {
  const call = client.downloadFile({ fileName });
  const writeStream = fs.createWriteStream(`downloaded_${fileName}`);

  call.on("data", (chunk) => writeStream.write(chunk.fileData));
  call.on("error", (err) => {
    console.error("Error downloading file:", err);
    writeStream.end();
  });
  call.on("end", () => {
    console.log(`Downloaded ${fileName}`);
    writeStream.end();
  });
}

function getMetadata(fileName) {
  client.getMetadata({ fileName }, (error, response) => {
    if (error) {
      console.error("Error getting metadata:", error);
      return;
    }
    console.log("Metadata:", response);
  });
}

// Make sure the test.txt file exists or use a known existing file
const testFile = "test.txt";
// Create test file if it doesn't exist
if (!fs.existsSync(testFile)) {
  fs.writeFileSync(testFile, "This is a test file for gRPC upload.");
  console.log(`Created test file: ${testFile}`);
}

// Test uploading a file
uploadFile(testFile);

// Test downloading the file
downloadFile(testFile);

// Test getting metadata
getMetadata(testFile);
