const fs = require('fs');
const path = require('path');

const DOCUMENTS_FILE = path.join(__dirname, '..', 'data', 'documents.json');

function ensureDocumentsFile() {
  const dir = path.dirname(DOCUMENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify([], null, 2));
  }
}

function getDocuments() {
  ensureDocumentsFile();
  const data = fs.readFileSync(DOCUMENTS_FILE, 'utf8');
  return JSON.parse(data);
}

function saveDocuments(documents) {
  ensureDocumentsFile();
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));
}

function findDocumentById(id) {
  const documents = getDocuments();
  return documents.find((doc) => String(doc.id) === String(id)) || null;
}

function getDocumentsByEmail(email) {
  const documents = getDocuments();
  if (!email) return documents;
  const normalized = email.trim().toLowerCase();
  return documents.filter(
    (doc) => (doc.uploadedBy || '').toLowerCase() === normalized
  );
}

function addDocument(document) {
  const documents = getDocuments();
  documents.push(document);
  saveDocuments(documents);
  return document;
}

function deleteDocumentById(id) {
  const documents = getDocuments();
  const index = documents.findIndex((doc) => String(doc.id) === String(id));
  if (index === -1) return null;
  const [removed] = documents.splice(index, 1);
  saveDocuments(documents);
  return removed;
}

function clearDocuments() {
  saveDocuments([]);
}

module.exports = {
  getDocuments,
  saveDocuments,
  findDocumentById,
  getDocumentsByEmail,
  addDocument,
  deleteDocumentById,
  clearDocuments,
  DOCUMENTS_FILE,
};
