const express = require('express');
const router = express.Router();
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Supported file types
const SUPPORTED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const SUPPORTED_DOCUMENT_TYPES = ['.pdf', '.txt', '.docx'];
const SUPPORTED_TYPES = [...SUPPORTED_IMAGE_TYPES, ...SUPPORTED_DOCUMENT_TYPES];

// Helper function to check if file is an image
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_TYPES.includes(ext);
}

// Helper function to check if file is a document
function isDocumentFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_DOCUMENT_TYPES.includes(ext);
}

// Helper function to validate file type
function validateFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_TYPES.includes(ext);
}

// Helper function to process image file (convert to base64)
async function processImage(filePath, originalName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(originalName).toLowerCase();
    let mimeType = 'image/jpeg';

    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.webp') mimeType = 'image/webp';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new Error('Failed to process image file');
  }
}

// Helper function to process PDF file
async function processPDF(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(fileBuffer);
    return pdfData.text;
  } catch (error) {
    throw new Error('Failed to extract text from PDF');
  }
}

// Helper function to process DOCX file
async function processDOCX(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error('Failed to extract text from document');
  }
}

// Helper function to process TXT file
function processTXT(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error('Failed to read text file');
  }
}

// POST /api/chat - Main chat endpoint
router.post('/', upload.single('file'), async (req, res) => {
  let uploadedFilePath = null;

  try {
    // Extract request data
    const message = req.body.message ? req.body.message.trim() : '';
    const file = req.file;
    let conversationHistory = [];

    // Parse conversation history
    if (req.body.conversationHistory) {
      try {
        conversationHistory = JSON.parse(req.body.conversationHistory);
        // Limit to last 10 messages to avoid token limits
        if (conversationHistory.length > 10) {
          conversationHistory = conversationHistory.slice(-10);
        }
      } catch (error) {
        // Invalid JSON, proceed with empty history
        conversationHistory = [];
      }
    }

    // Validate: at least one of message or file must be provided
    if (!message && !file) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a message or file'
      });
    }

    // Validate message length
    if (message && message.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long. Maximum 10,000 characters'
      });
    }

    // Validate file if provided
    if (file) {
      uploadedFilePath = file.path;

      // Check file size (multer should handle this, but double-check)
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds 5MB limit'
        });
      }

      // Validate file type
      if (!validateFileType(file.originalname)) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type. Allowed: jpg, png, gif, webp, pdf, txt, docx'
        });
      }
    }

    // Build OpenAI messages array
    let messages = [...conversationHistory];

    // Process file and build user message
    if (file) {
      if (isImageFile(file.originalname)) {
        // Image file - use vision API
        const imageDataUrl = await processImage(uploadedFilePath, file.originalname);

        messages.push({
          role: 'user',
          content: [
            { type: 'text', text: message || 'What do you see in this image?' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        });
      } else if (isDocumentFile(file.originalname)) {
        // Document file - extract text
        let extractedText = '';
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.pdf') {
          extractedText = await processPDF(uploadedFilePath);
        } else if (ext === '.docx') {
          extractedText = await processDOCX(uploadedFilePath);
        } else if (ext === '.txt') {
          extractedText = processTXT(uploadedFilePath);
        }

        // Combine message with document content
        const userContent = message
          ? `${message}\n\nDocument content:\n${extractedText}`
          : `Please analyze this document:\n\n${extractedText}`;

        messages.push({
          role: 'user',
          content: userContent
        });
      }
    } else {
      // Text-only message
      messages.push({
        role: 'user',
        content: message
      });
    }

    // Call OpenAI API
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 1000
      });

      const aiResponse = completion.choices[0].message.content;

      // Clean up uploaded file
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (error) {
          console.error('Failed to delete uploaded file:', error);
          // Don't fail the request if file deletion fails
        }
      }

      // Return success response
      res.json({
        success: true,
        message: aiResponse,
        role: 'assistant'
      });

    } catch (apiError) {
      // Handle OpenAI API errors
      console.error('OpenAI API error:', apiError);

      // Clean up uploaded file
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (error) {
          console.error('Failed to delete uploaded file:', error);
        }
      }

      // Check for specific error types
      if (apiError.status === 429) {
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please try again later'
        });
      }

      if (apiError.message && apiError.message.includes('API key')) {
        return res.status(500).json({
          success: false,
          error: 'OpenAI API key not configured'
        });
      }

      if (apiError.message && apiError.message.includes('content_policy')) {
        return res.status(400).json({
          success: false,
          error: 'Content violates usage policies'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to get AI response'
      });
    }

  } catch (error) {
    console.error('Request processing error:', error);

    // Clean up uploaded file if exists
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
      } catch (delError) {
        console.error('Failed to delete uploaded file:', delError);
      }
    }

    // Return appropriate error
    if (error.message.includes('Failed to process')) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'An error occurred processing your request'
    });
  }
});

module.exports = router;
