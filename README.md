# Distributed File Storage System

A scalable distributed file storage system inspired by Dropbox, built using MinIO for object storage and gRPC for efficient communication between services. This system provides redundancy, high availability, and eventual consistency through multiple storage nodes.

## Key Concepts

- **Distributed Storage**: Files are stored across multiple nodes for fault tolerance
- **Object Storage**: Using MinIO as the underlying object storage system
- **gRPC Communication**: Service-to-service communication via Protocol Buffers
- **Redundancy**: Multiple replicas of each file for data durability
- **Load Balancing**: Round-robin distribution of read operations across nodes
- **File Versioning**: ETag-based versioning for tracking file changes

## Architecture

This system consists of the following components:

1. **API Server**: Express.js REST API for client applications
2. **Storage Server**: gRPC server that interfaces with MinIO for storage operations
3. **MinIO Nodes**: Multiple MinIO instances that store the actual file data
4. **Client**: Web UI for interacting with the system

## Setup Instructions

### Prerequisites

- Node.js (v14 or later)
- Docker and Docker Compose (for MinIO)
- MinIO running on multiple ports (for simulating a distributed environment)

### Environment Setup

1. Clone the repository:

   ```
   git clone <repository-url>
   cd Distributed-File-Storage-System
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Create an `.env` file with the following variables:

   ```
   MINIO_ENDPOINT_1=localhost:9000
   MINIO_ENDPOINT_2=localhost:9001
   MINIO_ENDPOINT_3=localhost:9002
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   ```

4. Setup MinIO using Docker Compose:
   ```
   docker-compose up -d
   ```

## Starting the System

1. Run `npm run dev` in the root directory to boot up the server and api

2. Access the web interface at http://localhost:3000

## API Endpoints

- `POST /upload` - Upload a new file
- `GET /files` - List all available files
- `GET /download/:fileName` - Download a specific file
- `GET /metadata/:fileName` - Get metadata for a specific file
- `DELETE /

## Features

- **File Upload**: Upload files securely to the distributed storage system
- **File Download**: Download any stored file from any node
- **File Listing**: View all files in the storage system
- **File Deletion**: Delete a file from the storage system
- **Metadata Retrieval**: Get information about files including upload time and version
- **High Availability**: Files are replicated across multiple nodes
- **Fault Tolerance**: System continues to operate even if some nodes fail

## Storage Implementation

Files are stored redundantly across multiple MinIO instances. When a file is uploaded:

1. The file is uploaded to all configured MinIO nodes
2. Metadata is stored with the file
3. Subsequent read operations are distributed using a round-robin approach

## Development

### Project Structure

- `api-server.js` - REST API server for client interaction
- `server.js` - gRPC server for storage operations
- `client.js` - Test client for gRPC services
- `protos/storage.proto` - Protocol Buffer definitions
- `public/` - Web client resources

### Extending the System

To add new features:

1. Update the Protocol Buffers definition in `protos/storage.proto`
2. Implement the new service methods in `server.js`
3. Add API endpoints in `api-server.js`

## Future Enhancements

- Add authentication and authorization
- Implement file deduplication
- Add more robust error handling and recovery
- Implement file versioning and history
