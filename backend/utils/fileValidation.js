const path = require('path');

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — matches upload UI note

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx'];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function getExtension(filename) {
  return path.extname(filename || '').toLowerCase();
}

function isAllowedExtension(filename) {
  return ALLOWED_EXTENSIONS.includes(getExtension(filename));
}

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

function validateUploadedFile(file) {
  if (!file) {
    return { ok: false, message: 'No file uploaded. Use form field name "file".' };
  }

  if (!isAllowedExtension(file.originalname)) {
    return {
      ok: false,
      message: 'Invalid file type. Allowed: .pdf, .docx, .pptx',
    };
  }

  if (file.mimetype && !isAllowedMimeType(file.mimetype)) {
    return {
      ok: false,
      message: 'Invalid MIME type for uploaded document',
    };
  }

  if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message: 'File too large. Maximum size is 25 MB per document',
    };
  }

  return { ok: true };
}

function multerFileFilter(_req, file, cb) {
  if (!isAllowedExtension(file.originalname)) {
    return cb(new Error('Invalid file type. Allowed: .pdf, .docx, .pptx'));
  }
  if (file.mimetype && !isAllowedMimeType(file.mimetype)) {
    return cb(new Error('Invalid MIME type for uploaded document'));
  }
  return cb(null, true);
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  getExtension,
  isAllowedExtension,
  isAllowedMimeType,
  validateUploadedFile,
  multerFileFilter,
};
