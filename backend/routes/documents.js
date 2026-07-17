const express = require('express');
const {
  getDocuments,
  getDocumentsByEmail,
  findDocumentById,
} = require('../utils/documentStore');

const router = express.Router();

function toPublicDocument(doc) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    originalName: doc.originalName || doc.fileName,
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedBy: doc.uploadedBy,
    uploadedAt: doc.uploadedAt,
    status: doc.status || 'ready',
  };
}

// GET /api/documents?email=student@university.edu
router.get('/', (req, res) => {
  try {
    const { email } = req.query;
    const documents = email
      ? getDocumentsByEmail(String(email))
      : getDocuments();

    return res.status(200).json({
      success: true,
      message: 'Documents retrieved successfully',
      count: documents.length,
      documents: documents.map(toPublicDocument),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving documents',
    });
  }
});

// GET /api/documents/:id
router.get('/:id', (req, res) => {
  try {
    const document = findDocumentById(req.params.id);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Document retrieved successfully',
      document: toPublicDocument(document),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error while retrieving document',
    });
  }
});

module.exports = router;
