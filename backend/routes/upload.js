const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { addDocument } = require('../utils/documentStore');
const {
  MAX_FILE_SIZE_BYTES,
  multerFileFilter,
  validateUploadedFile,
} = require('../utils/fileValidation');

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
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: multerFileFilter,
});

function handleMulterErrors(err, _req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 25 MB per document',
      });
    }
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || 'Invalid upload',
  });
}

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    handleMulterErrors(err, req, res, () => {
      try {
        const validation = validateUploadedFile(req.file);
        if (!validation.ok) {
          if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          return res.status(400).json({
            success: false,
            message: validation.message,
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
  });
});

module.exports = router;
