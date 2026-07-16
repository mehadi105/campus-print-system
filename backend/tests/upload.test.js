const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const app = require('../server');
const { clearDocuments } = require('../utils/documentStore');
const {
  isAllowedExtension,
  validateUploadedFile,
  MAX_FILE_SIZE_BYTES,
} = require('../utils/fileValidation');

describe('File validation helpers (SCRUM-31 / SCRUM-33)', () => {
  it('allows pdf, docx, and pptx extensions', () => {
    assert.equal(isAllowedExtension('notes.pdf'), true);
    assert.equal(isAllowedExtension('lab.docx'), true);
    assert.equal(isAllowedExtension('slides.pptx'), true);
    assert.equal(isAllowedExtension('photo.png'), false);
  });

  it('rejects oversized files in validateUploadedFile', () => {
    const result = validateUploadedFile({
      originalname: 'huge.pdf',
      mimetype: 'application/pdf',
      size: MAX_FILE_SIZE_BYTES + 1,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /25 MB/i);
  });
});

describe('Upload Feature API (SCRUM-33)', () => {
  let server;
  let baseUrl;
  let tempDir;

  before(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-upload-'));
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    clearDocuments();
    fs.rmSync(tempDir, { recursive: true, force: true });
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    clearDocuments();
  });

  async function postFile(filename, contents, email = 'sadi@university.edu') {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, contents);

    const form = new FormData();
    const blob = new Blob([contents], { type: 'application/pdf' });
    form.append('file', blob, filename);
    form.append('email', email);

    return fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: form,
    });
  }

  it('uploads a valid PDF and returns document metadata', async () => {
    const res = await postFile('assignment.pdf', '%PDF-1.4 sample content');
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.document.originalName, 'assignment.pdf');
    assert.equal(body.document.uploadedBy, 'sadi@university.edu');
    assert.equal(body.document.status, 'ready');
  });

  it('rejects upload without student email', async () => {
    const form = new FormData();
    form.append('file', new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'a.pdf');

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.match(body.message, /email/i);
  });

  it('rejects disallowed file types', async () => {
    const form = new FormData();
    form.append('file', new Blob(['fake'], { type: 'image/png' }), 'photo.png');
    form.append('email', 'sadi@university.edu');

    const res = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: form,
    });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.match(body.message, /Invalid file type/i);
  });
});
