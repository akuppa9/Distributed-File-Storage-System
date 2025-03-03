document.addEventListener("DOMContentLoaded", () => {
  const apiUrl = "http://localhost:3000";
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const fileList = document.getElementById("fileList");
  const progressContainer = document.getElementById("progressContainer");
  const progressBar = document.getElementById("progressBar");
  const metadataCard = document.getElementById("metadataCard");
  const metadataContent = document.getElementById("metadataContent");

  let selectedFile = null;

  // Initialize
  loadFiles();

  // Event Listeners
  dropArea.addEventListener("click", () => fileInput.click());

  dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("active");
  });

  dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("active");
  });

  dropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    dropArea.classList.remove("active");

    if (e.dataTransfer.files.length) {
      selectedFile = e.dataTransfer.files[0];
      dropArea.innerHTML = `<p>Selected: ${selectedFile.name}</p>`;
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) {
      selectedFile = fileInput.files[0];
      dropArea.innerHTML = `<p>Selected: ${selectedFile.name}</p>`;
    }
  });

  uploadBtn.addEventListener("click", uploadFile);

  // Functions
  function loadFiles() {
    fetch(`${apiUrl}/files`)
      .then((response) => response.json())
      .then((data) => {
        if (data.files && data.files.length) {
          fileList.innerHTML = "";
          data.files.forEach((file) => {
            addFileToList(file);
          });
        } else {
          fileList.innerHTML = '<p class="loading">No files found</p>';
        }
      })
      .catch((error) => {
        console.error("Error loading files:", error);
        fileList.innerHTML = '<p class="loading">Error loading files</p>';
      });
  }

  function addFileToList(fileName) {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    const nameSpan = document.createElement("span");
    nameSpan.textContent = fileName;

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "file-actions";

    const downloadBtn = document.createElement("button");
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", () => downloadFile(fileName));

    const metadataBtn = document.createElement("button");
    metadataBtn.textContent = "Metadata";
    metadataBtn.addEventListener("click", () => getMetadata(fileName));

    actionsDiv.appendChild(downloadBtn);
    actionsDiv.appendChild(metadataBtn);

    fileItem.appendChild(nameSpan);
    fileItem.appendChild(actionsDiv);

    fileList.appendChild(fileItem);
  }

  function uploadFile() {
    if (!selectedFile) {
      alert("Please select a file first");
      return;
    }

    // Show progress bar
    progressContainer.style.display = "block";
    progressBar.style.width = "0%";

    const formData = new FormData();
    formData.append("file", selectedFile);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = (event.loaded / event.total) * 100;
        progressBar.style.width = percentComplete + "%";
      }
    });

    xhr.onreadystatechange = function () {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          alert(response.message);

          // Reset UI
          dropArea.innerHTML =
            "<p>Drag & Drop files here or click to select</p>";
          selectedFile = null;
          progressContainer.style.display = "none";

          // Reload file list
          loadFiles();
        } else {
          alert("Error uploading file");
          progressContainer.style.display = "none";
        }
      }
    };

    xhr.open("POST", `${apiUrl}/upload`);
    xhr.send(formData);
  }

  function downloadFile(fileName) {
    window.location.href = `${apiUrl}/download/${fileName}`;
  }

  function getMetadata(fileName) {
    fetch(`${apiUrl}/metadata/${fileName}`)
      .then((response) => response.json())
      .then((data) => {
        metadataCard.style.display = "block";
        metadataContent.innerHTML = `
                    <p><strong>File Name:</strong> ${data.fileName || "N/A"}</p>
                    <p><strong>Upload Time:</strong> ${
                      data.uploadTime || "N/A"
                    }</p>
                    <p><strong>Version:</strong> ${data.version || "N/A"}</p>
                `;

        // Scroll to metadata card
        metadataCard.scrollIntoView({ behavior: "smooth" });
      })
      .catch((error) => {
        console.error("Error getting metadata:", error);
        alert("Error retrieving file metadata");
      });
  }
});
