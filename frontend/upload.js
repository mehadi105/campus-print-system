document.addEventListener('DOMContentLoaded', () => {
  if (document.body?.dataset?.page !== 'dashboard') return;

  const API_BASE = window.CAMPUS_API_BASE || 'http://localhost:3000';
  const MAX_BYTES = 25 * 1024 * 1024;
  const ALLOWED = ['.pdf', '.docx', '.pptx'];

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const queueList = document.getElementById('uploadQueue');
  const queueCount = document.querySelector('.queue-count');
  const queuedFilesStat = document.getElementById('queued-files-count');

  if (!dropZone || !fileInput || !queueList) return;

  const queue = [];

  function extensionOf(name) {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function iconClass(filename) {
    const ext = extensionOf(filename);
    if (ext === '.pdf') return 'file-icon-pdf';
    if (ext === '.docx') return 'file-icon-docx';
    if (ext === '.pptx') return 'file-icon-pptx';
    return 'file-icon-pdf';
  }

  function currentStudentEmail() {
    try {
      const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
      return student?.email || '';
    } catch {
      return '';
    }
  }

  function updateCounts() {
    const label = `${queue.length} file${queue.length === 1 ? '' : 's'}`;
    if (queueCount) queueCount.textContent = label;
    if (queuedFilesStat) queuedFilesStat.textContent = String(queue.length);
  }

  function renderQueue() {
    queueList.innerHTML = '';

    if (queue.length === 0) {
      queueList.innerHTML =
        '<li class="queue-empty">No files in queue yet. Drop or browse files to upload.</li>';
      updateCounts();
      return;
    }

    queue.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'queue-item';
      li.dataset.status = item.status;
      li.dataset.id = item.localId;

      const progress = item.progress ?? 0;
      const statusText =
        item.status === 'ready'
          ? 'Ready to Print'
          : item.status === 'error'
            ? item.error || 'Failed'
            : 'Uploading…';

      li.innerHTML = `
        <div class="queue-item-icon ${iconClass(item.name)}" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4z"/></svg>
        </div>
        <div class="queue-item-body">
          <div class="queue-item-top">
            <p class="queue-file-name" title="${item.name}">${item.name}</p>
            <span class="queue-file-size">${formatSize(item.size)}</span>
          </div>
          <div class="queue-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
            <div class="queue-progress-fill ${item.status === 'ready' ? 'is-complete' : ''}" style="width: ${progress}%"></div>
          </div>
        </div>
        <span class="queue-status status-${item.status}">${statusText}</span>
        <button type="button" class="queue-remove-btn" data-remove="${item.localId}" aria-label="Remove ${item.name}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>
        </button>
      `;

      queueList.appendChild(li);
    });

    updateCounts();
  }

  function validateFile(file) {
    const ext = extensionOf(file.name);
    if (!ALLOWED.includes(ext)) {
      return 'Invalid file type. Allowed: .pdf, .docx, .pptx';
    }
    if (file.size > MAX_BYTES) {
      return 'File too large. Maximum size is 25 MB per document';
    }
    return null;
  }

  async function uploadFile(item) {
    const email = currentStudentEmail();
    if (!email) {
      item.status = 'error';
      item.error = 'Please login first';
      item.progress = 0;
      renderQueue();
      return;
    }

    const form = new FormData();
    form.append('file', item.file);
    form.append('email', email);

    item.status = 'uploading';
    item.progress = 15;
    renderQueue();

    try {
      const response = await fetch(`${API_BASE}/api/uploads`, {
        method: 'POST',
        body: form,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        item.status = 'error';
        item.error = data.message || 'Upload failed';
        item.progress = 0;
      } else {
        item.status = 'ready';
        item.progress = 100;
        item.serverId = data.document?.id;
      }
    } catch {
      item.status = 'error';
      item.error = 'Cannot reach upload API';
      item.progress = 0;
    }

    renderQueue();
  }

  function enqueueFiles(fileList) {
    Array.from(fileList || []).forEach((file) => {
      const error = validateFile(file);
      const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item = {
        localId,
        file,
        name: file.name,
        size: file.size,
        status: error ? 'error' : 'uploading',
        error: error || '',
        progress: error ? 0 : 5,
      };
      queue.push(item);
      renderQueue();
      if (!error) uploadFile(item);
    });
  }

  browseBtn?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    enqueueFiles(fileInput.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragover');
    });
  });

  ['dragleave', 'drop'].forEach((type) => {
    dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragover');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    enqueueFiles(event.dataTransfer?.files);
  });

  queueList.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-remove]');
    if (!btn) return;
    const id = btn.getAttribute('data-remove');
    const index = queue.findIndex((item) => item.localId === id);
    if (index >= 0) {
      queue.splice(index, 1);
      renderQueue();
    }
  });

  renderQueue();
});
