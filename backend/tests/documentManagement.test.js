const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const {
  clearDocuments,
  addDocument,
  getDocuments,
  getDocumentsByEmail,
  findDocumentById,
  deleteDocumentById,
} = require('../utils/documentStore');

function sampleDoc(overrides = {}) {
  return {
    id: overrides.id || `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fileName: overrides.fileName || 'assignment.pdf',
    originalName: overrides.originalName || 'assignment.pdf',
    mimeType: overrides.mimeType || 'application/pdf',
    size: overrides.size || 1024,
    uploadedBy: overrides.uploadedBy || 'sadi@university.edu',
    uploadedAt: overrides.uploadedAt || new Date().toISOString(),
    status: overrides.status || 'ready',
  };
}

describe('Document store (document management)', () => {
  beforeEach(() => {
    clearDocuments();
  });

  it('starts empty', () => {
    assert.equal(getDocuments().length, 0);
  });

  it('adds and lists documents', () => {
    addDocument(sampleDoc({ id: 'doc-a', fileName: 'a.pdf' }));
    addDocument(sampleDoc({ id: 'doc-b', fileName: 'b.pdf', uploadedBy: 'imtiaz@university.edu' }));

    const docs = getDocuments();
    assert.equal(docs.length, 2);
    assert.equal(docs[0].fileName, 'a.pdf');
    assert.equal(docs[1].uploadedBy, 'imtiaz@university.edu');
  });

  it('filters documents by student email', () => {
    addDocument(sampleDoc({ id: 'doc-1', uploadedBy: 'sadi@university.edu' }));
    addDocument(sampleDoc({ id: 'doc-2', uploadedBy: 'imtiaz@university.edu' }));
    addDocument(sampleDoc({ id: 'doc-3', uploadedBy: 'sadi@university.edu' }));

    const mine = getDocumentsByEmail('sadi@university.edu');
    assert.equal(mine.length, 2);
    assert.ok(mine.every((d) => d.uploadedBy === 'sadi@university.edu'));
  });

  it('finds a document by id', () => {
    addDocument(sampleDoc({ id: 'doc-find', fileName: 'notes.docx' }));
    const found = findDocumentById('doc-find');
    assert.ok(found);
    assert.equal(found.fileName, 'notes.docx');
  });

  it('deletes a document by id', () => {
    addDocument(sampleDoc({ id: 'doc-del' }));
    const removed = deleteDocumentById('doc-del');
    assert.ok(removed);
    assert.equal(findDocumentById('doc-del'), null);
    assert.equal(getDocuments().length, 0);
  });
});

describe('View Documents API (SCRUM-36 + SCRUM-39)', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    clearDocuments();
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    clearDocuments();
  });

  it('GET /api/documents returns empty list', async () => {
    const res = await fetch(`${baseUrl}/api/documents`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.count, 0);
    assert.deepEqual(body.documents, []);
  });

  it('GET /api/documents lists seeded documents', async () => {
    addDocument(sampleDoc({ id: 'api-1', fileName: 'lab.pdf', uploadedBy: 'sadi@university.edu' }));
    addDocument(sampleDoc({ id: 'api-2', fileName: 'slides.pptx', uploadedBy: 'imtiaz@university.edu' }));

    const res = await fetch(`${baseUrl}/api/documents`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.count, 2);
    assert.equal(body.documents[0].id, 'api-1');
    assert.equal(body.documents[1].fileName, 'slides.pptx');
  });

  it('GET /api/documents?email= filters for a student', async () => {
    addDocument(sampleDoc({ id: 'api-sadi', uploadedBy: 'sadi@university.edu' }));
    addDocument(sampleDoc({ id: 'api-other', uploadedBy: 'imtiaz@university.edu' }));

    const res = await fetch(
      `${baseUrl}/api/documents?email=${encodeURIComponent('sadi@university.edu')}`
    );
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.documents[0].id, 'api-sadi');
  });

  it('GET /api/documents/:id returns one document', async () => {
    addDocument(sampleDoc({ id: 'api-one', fileName: 'thesis.pdf', size: 2048 }));

    const res = await fetch(`${baseUrl}/api/documents/api-one`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.document.fileName, 'thesis.pdf');
    assert.equal(body.document.size, 2048);
  });

  it('GET /api/documents/:id returns 404 when missing', async () => {
    const res = await fetch(`${baseUrl}/api/documents/does-not-exist`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.success, false);
    assert.match(body.message, /not found/i);
  });

  it('supports full document management flow: add → list → view → delete', async () => {
    const created = addDocument(
      sampleDoc({
        id: 'flow-1',
        fileName: 'coursework.pdf',
        uploadedBy: 'sadi@university.edu',
      })
    );

    const listRes = await fetch(
      `${baseUrl}/api/documents?email=${encodeURIComponent(created.uploadedBy)}`
    );
    const listBody = await listRes.json();
    assert.equal(listBody.count, 1);

    const viewRes = await fetch(`${baseUrl}/api/documents/${created.id}`);
    const viewBody = await viewRes.json();
    assert.equal(viewBody.document.fileName, 'coursework.pdf');

    const removed = deleteDocumentById(created.id);
    assert.ok(removed);

    const afterRes = await fetch(`${baseUrl}/api/documents/${created.id}`);
    assert.equal(afterRes.status, 404);
  });
});
