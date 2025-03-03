const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const app = express();
const port = 3000;
const upload = multer({ dest: "uploads/" });

// Set up gRPC client
const packageDefinition = protoLoader.loadSync("protos/storage.proto");
const storageProto = grpc.loadPackageDefinition(packageDefinition).FileStorage;
const client = new storageProto(
  "localhost:5001",
  grpc.credentials.createInsecure()
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API endpoint to upload a file
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const filePath = req.file.path;
  const fileName = req.file.originalname;

  // Create metadata to pass fileName
  const metadata = new grpc.Metadata();
  metadata.set("fileName", fileName);

  // Upload file to gRPC server
  const call = client.uploadFile(metadata, (error, response) => {
    // Delete temporary file
    fs.unlinkSync(filePath);

    if (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({ error: error.message });
    }

    // After successful upload, get the updated file list
    client.listFiles({}, (listError, listResponse) => {
      if (listError) {
        console.error("Error listing files:", listError);
        return res.json({
          message: response.message,
          files: [],
        });
      }
      res.json({
        message: response.message,
        files: listResponse.files || [],
      });
    });
  });

  // Read file and send it in chunks
  const fileStream = fs.createReadStream(filePath);
  fileStream.on("data", (chunk) => call.write({ fileData: chunk }));
  fileStream.on("end", () => call.end());
  fileStream.on("error", (err) => {
    call.end();
    console.error("Error reading file:", err);
    res.status(500).json({ error: err.message });
  });
});

// API endpoint to list files
app.get("/files", (req, res) => {
  client.listFiles({}, (error, response) => {
    if (error) {
      console.error("Error listing files:", error);
      return res.status(500).json({ error: error.message });
    }
    res.json({ files: response.files || [] });
  });
});

// API endpoint to download a file
app.get("/download/:fileName", (req, res) => {
  const fileName = req.params.fileName;
  const chunks = [];
  let hasResponded = false;

  const call = client.downloadFile({ fileName });

  call.on("data", (chunk) => {
    chunks.push(chunk.fileData);
  });

  call.on("end", () => {
    if (hasResponded) return;

    if (chunks.length === 0) {
      hasResponded = true;
      return res.status(404).json({ error: "File not found" });
    }

    const buffer = Buffer.concat(chunks);
    hasResponded = true;
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  });

  call.on("error", (err) => {
    if (hasResponded) return;

    console.error("Error downloading file:", err);
    hasResponded = true;

    if (err.code === 2) {
      // Not found error (UNKNOWN in gRPC)
      res.status(404).json({ error: "File not found" });
    } else {
      res.status(500).json({ error: "Failed to download file" });
    }
  });
});

// API endpoint to get file metadata
app.get("/metadata/:fileName", (req, res) => {
  const fileName = req.params.fileName;

  client.getMetadata({ fileName }, (error, response) => {
    if (error) {
      console.error("Error getting metadata:", error);
      return res.status(500).json({ error: error.message });
    }
    res.json(response);
  });
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Start the server
app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
