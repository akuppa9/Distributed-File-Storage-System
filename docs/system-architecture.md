# Distributed File Storage System: Architecture & Design

## Core Components Overview

### 1. Frontend (public/index.html, styles.css, app.js)

The frontend provides a user interface for:

- Uploading files via drag-and-drop or file selection
- Viewing a list of stored files
- Downloading files
- Viewing file metadata
- Deleting files

### 2. API Server (api-server.js)

Acts as an intermediary between the frontend and the storage system by:

- Exposing REST HTTP endpoints for browser clients
- Translating HTTP requests into gRPC calls to the storage server
- Managing temporary file handling during uploads
- Handling authentication (could be added in the future)

### 3. Storage Server (server.js)

The core storage logic that:

- Implements gRPC service methods defined in the protocol buffer
- Manages communication with multiple MinIO storage nodes
- Ensures redundancy by replicating files across nodes
- Implements load balancing for read operations
- Maintains consistency across storage nodes

### 4. Protocol Buffer Definition (storage.proto)

Defines the contract between API server and storage server:

- Service method definitions (upload, download, delete, etc.)
- Message formats for requests and responses
- Streaming capabilities for efficient file transfer

### 5. MinIO Storage

The actual distributed object storage:

- Multiple instances for redundancy and fault tolerance
- Stores files as objects in buckets
- Provides versioning and metadata capabilities

### 6. Test Client (client.js)

A utility for testing gRPC functionality directly:

- Makes direct gRPC calls to the storage server
- Useful for debugging and testing without the API server

## Data Flow and Interactions

### File Upload Flow:

1. User selects a file in the frontend
2. Frontend sends HTTP POST to `/upload` endpoint with file data
3. API server receives file and stores it temporarily
4. API server initiates a gRPC bidirectional stream to the storage server
5. File chunks are streamed to the storage server
6. Storage server replicates the file to all MinIO nodes concurrently
7. Upon completion, the storage server returns success message
8. API server retrieves updated file list and returns to frontend
9. Frontend updates UI to show the new file

### File Download Flow:

1. User clicks "Download" button for a file
2. Frontend redirects to `/download/:fileName` endpoint
3. API server initiates a gRPC stream from storage server
4. Storage server selects a MinIO node using round-robin load balancing
5. Selected node streams file content back to API server
6. API server streams content to the browser as a download

### File Listing Flow:

1. Frontend requests `/files` endpoint
2. API server calls listFiles gRPC method
3. Storage server queries a MinIO node for file listing
4. File list is returned through gRPC to API server
5. API server returns JSON list to frontend
6. Frontend renders file list with action buttons

### File Deletion Flow:

1. User clicks "Delete" button for a file
2. Frontend prompts for confirmation
3. If confirmed, frontend sends DELETE request to `/files/:fileName` endpoint
4. API server calls deleteFile gRPC method
5. Storage server removes the file from all MinIO nodes
6. Success response flows back to frontend
7. Frontend refreshes the file list

### Metadata Retrieval Flow:

1. User clicks "Metadata" button for a file
2. Frontend requests `/metadata/:fileName` endpoint
3. API server calls getMetadata gRPC method
4. Storage server retrieves metadata from MinIO
5. Metadata returns through gRPC to API server and then to frontend
6. Frontend displays metadata in a card

## Key Design Principles

### 1. Distributed Storage

Files are stored across multiple nodes to ensure:

- **Redundancy**: Multiple copies prevent data loss if a node fails
- **Availability**: System remains operational even if some nodes are down
- **Throughput**: Multiple nodes can serve read requests concurrently

### 2. Separation of Concerns

- **Frontend**: Only handling UI and user interactions
- **API Server**: REST endpoint management and temporary file handling
- **Storage Server**: Core storage logic and MinIO interaction
- **Protocol Buffers**: Clear contract between services

### 3. Efficient Data Transfer

- **Streaming**: Files are transferred in chunks rather than all at once
- **gRPC**: Efficient binary protocol reduces overhead compared to JSON
- **Load Balancing**: Round-robin distribution balances load across nodes

### 4. Error Handling

- Response handling prevents headers being sent multiple times
- Error codes are properly mapped between gRPC and HTTP
- Failures in any node don't break the entire system

### 5. Eventual Consistency

- All nodes eventually have the same files through replication
- Deletions propagate to all nodes to maintain consistency

## Technology Choices and Rationale

### 1. MinIO

- **What**: S3-compatible object storage system
- **Why**:
  - Easy to deploy and scale
  - Compatible with AWS S3 API
  - Supports object versioning and metadata
  - Can run in distributed mode for true clustering
  - Open source with strong community support

### 2. gRPC

- **What**: High-performance RPC framework by Google
- **Why**:
  - Efficient binary communication protocol
  - Support for bidirectional streaming
  - Strongly typed interfaces via Protocol Buffers
  - Lower overhead than REST for service-to-service communication
  - Built-in code generation for client/server stubs

### 3. Express.js

- **What**: Web framework for Node.js
- **Why**:
  - Well-established framework for HTTP APIs
  - Middleware ecosystem for common tasks (CORS, body parsing)
  - Easy to integrate with frontend and gRPC clients
  - Familiar to many developers

### 4. Modern Frontend

- **What**: HTML, CSS, JavaScript without frameworks
- **Why**:
  - Keeps the frontend simple and lightweight
  - No build step required
  - Easy to understand and modify
  - Demonstrates core principles without framework abstractions

## Implementation Details

### Redundancy Strategy

Files are actively replicated to all configured MinIO nodes during upload. This approach ensures:

- No single point of failure in storage
- Read operations can be distributed across nodes
- System can survive node failures without data loss

### Load Balancing

A simple round-robin algorithm distributes read operations across available MinIO nodes:

```javascript
// Round-robin mechanism for load balancing read operations
let currentClientIndex = 0;

function getNextClient() {
  const client = minioClients[currentClientIndex];
  currentClientIndex = (currentClientIndex + 1) % minioClients.length;
  return client;
}
```

This distributes the read load and improves overall system throughput.

### Streaming File Transfer

Rather than loading entire files into memory, the system uses streams throughout the upload and download process:

- Frontend → API Server: Using FormData and XMLHttpRequest
- API Server → Storage Server: Using gRPC bidirectional streaming
- Storage Server → MinIO: Using MinIO client streaming APIs

This approach allows handling of large files with minimal memory footprint.

### Error Handling and Recovery

The system includes several error handling mechanisms:

- Preventing multiple HTTP responses
- Mapping gRPC error codes to appropriate HTTP status codes
- Cleanup of temporary files after successful or failed uploads
- Proper error propagation from storage nodes to clients

## Future Enhancement Opportunities

1. **Authentication & Authorization**:

   - User accounts with login/registration
   - Role-based permissions for files
   - Access control lists for shared files

2. **Advanced Storage Features**:

   - File deduplication to save storage space
   - Compression for efficient storage
   - Server-side encryption for security
   - Automatic file versioning

3. **System Improvements**:

   - More sophisticated load balancing based on node health
   - Automatic node recovery procedures
   - Monitoring and alerting system
   - Administrative dashboard

4. **User Experience**:
   - Folder organization
   - Batch operations (upload, download, delete)
   - Preview for common file types
   - Sharing features with configurable permissions
