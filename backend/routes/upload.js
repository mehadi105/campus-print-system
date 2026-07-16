const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { addDocument } = require('../utils/documentStore');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Use form field name "file".',
      });
    }

    const uploadedBy = (req.body.email || req.body.uploadedBy || '').trim();
    if (!uploadedBy) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Student email is required (field: email)',
      });
    }

    const document = addDocument({
      id: `doc-${Date.now()}`,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      storedPath: req.file.path,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      status: 'ready',
    });

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      document: {
        id: document.id,
        fileName: document.fileName,
        originalName: document.originalName,
        mimeType: document.mimeType,
        size: document.size,
        uploadedBy: document.uploadedBy,
        uploadedAt: document.uploadedAt,
        status: document.status,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error during file upload',
    });
  }
});

module.exports = router;
