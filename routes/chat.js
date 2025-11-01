const express = require('express');
const router = express.Router();
const multer = require('multer');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Export libraries
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const ExcelJS = require('exceljs');

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
router.post('/', upload.array('file'), async (req, res) => {
  let uploadedFilePaths = [];

  try {
    // Extract request data
    const message = req.body.message ? req.body.message.trim() : '';
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

    // Validate: at least one of message or files must be provided
    if (!message && (!req.files || req.files.length === 0)) {
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

    // Validate and collect files if provided
    const validatedFiles = [];
    const skippedFiles = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // Check file size (multer should handle this, but double-check)
        if (file.size > 5 * 1024 * 1024) {
          skippedFiles.push(`${file.originalname} exceeds 5MB limit`);
          continue;
        }

        // Validate file type
        if (!validateFileType(file.originalname)) {
          skippedFiles.push(`${file.originalname} is unsupported type`);
          continue;
        }

        // Valid file - add to collection
        validatedFiles.push(file);
        uploadedFilePaths.push(file.path);
      }
    }

    // If files were provided but all failed validation, return error
    if (req.files && req.files.length > 0 && validatedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: `All files failed validation. Reasons: ${skippedFiles.join(', ')}`
      });
    }

    // Build OpenAI messages array
    let messages = [...conversationHistory];

    // Process files and build user message
    if (validatedFiles.length > 0) {
      // Separate files into images and documents
      const imageFiles = validatedFiles.filter(f => isImageFile(f.originalname));
      const documentFiles = validatedFiles.filter(f => isDocumentFile(f.originalname));

      // Create composite message content
      const content = [];

      // Add user message text
      if (message) {
        content.push({ type: 'text', text: message });
      } else if (validatedFiles.length > 0) {
        content.push({ type: 'text', text: 'Please analyze these files:' });
      }

      // Process all image files
      for (const imageFile of imageFiles) {
        const imageDataUrl = await processImage(imageFile.path, imageFile.originalname);
        content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
      }

      // Process all document files
      if (documentFiles.length > 0) {
        let allDocText = 'Document content:\n';

        for (const docFile of documentFiles) {
          let extractedText = '';
          const ext = path.extname(docFile.originalname).toLowerCase();

          if (ext === '.pdf') {
            extractedText = await processPDF(docFile.path);
          } else if (ext === '.docx') {
            extractedText = await processDOCX(docFile.path);
          } else if (ext === '.txt') {
            extractedText = processTXT(docFile.path);
          }

          allDocText += `${docFile.originalname}: ${extractedText}\n`;
        }

        content.push({ type: 'text', text: allDocText });
      }

      messages.push({
        role: 'user',
        content: content
      });
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

      // Clean up uploaded files
      for (const filePath of uploadedFilePaths) {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error('Failed to delete uploaded file:', error);
            // Don't fail the request if file deletion fails
          }
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

      // Clean up uploaded files
      for (const filePath of uploadedFilePaths) {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            console.error('Failed to delete uploaded file:', error);
          }
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

    // Clean up uploaded files if exist
    for (const filePath of uploadedFilePaths) {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (delError) {
          console.error('Failed to delete uploaded file:', delError);
        }
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

// ===== EXPORT FUNCTIONALITY =====

// Helper function to format date to human-readable format
function formatHumanReadableDate(date) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12; // Convert 0 to 12

  return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[/\\:*?"<>|]/g, '').trim();
}

// Helper function to generate timestamp
function generateTimestamp() {
  return new Date().toISOString().replace(/:/g, '').replace(/\..+/, '').replace('T', '-');
}

// Generate PDF
function generatePDF(messages) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      // Collect data chunks
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Add title
      doc.fontSize(20).font('Helvetica-Bold').text('Chat Conversation Export', { align: 'center' });
      doc.moveDown(0.5);

      // Add export date
      doc.fontSize(12).font('Helvetica').text(`Exported: ${formatHumanReadableDate(new Date())}`, { align: 'center' });
      doc.moveDown(1);

      // Add each message
      messages.forEach((msg, index) => {
        const timestamp = msg.timestamp ? new Date(msg.timestamp) : null;
        const dateStr = timestamp ? formatHumanReadableDate(timestamp) : 'Unknown date';
        const role = msg.role === 'user' ? 'User' : 'Assistant';

        // Add timestamp and role (bold)
        doc.fontSize(12).font('Helvetica-Bold').text(`${dateStr} - ${role}:`);
        doc.moveDown(0.3);

        // Add content (normal)
        doc.fontSize(11).font('Helvetica').text(msg.content || '', { align: 'left' });
        doc.moveDown(0.3);

        // Add attached files if any
        if (msg.fileNames && msg.fileNames.length > 0) {
          doc.fontSize(10).font('Helvetica-Oblique').text(`Attached files: ${msg.fileNames.join(', ')}`);
          doc.moveDown(0.3);
        }

        // Add space between messages
        doc.moveDown(0.5);

        // Add page break if needed (avoid breaking in middle of message)
        if (doc.y > 700) {
          doc.addPage();
        }
      });

      // Add footer
      doc.fontSize(11).font('Helvetica').text(`Total messages: ${messages.length}`, { align: 'center' });

      // Finalize PDF
      doc.end();

    } catch (error) {
      reject(error);
    }
  });
}

// Generate DOCX
async function generateDOCX(messages) {
  try {
    const sections = [];

    // Add title
    sections.push(
      new Paragraph({
        text: 'Chat Conversation Export',
        heading: HeadingLevel.HEADING_1,
        alignment: 'center'
      })
    );

    // Add export date
    sections.push(
      new Paragraph({
        text: `Exported: ${formatHumanReadableDate(new Date())}`,
        alignment: 'center'
      })
    );

    // Add blank line
    sections.push(new Paragraph({ text: '' }));

    // Add each message
    messages.forEach(msg => {
      const timestamp = msg.timestamp ? new Date(msg.timestamp) : null;
      const dateStr = timestamp ? formatHumanReadableDate(timestamp) : 'Unknown date';
      const role = msg.role === 'user' ? 'User' : 'Assistant';

      // Add timestamp and role (bold, heading 2)
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${dateStr} - ${role}:`,
              bold: true
            })
          ],
          heading: HeadingLevel.HEADING_2
        })
      );

      // Add content
      sections.push(
        new Paragraph({
          text: msg.content || ''
        })
      );

      // Add attached files if any
      if (msg.fileNames && msg.fileNames.length > 0) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Attached files: ${msg.fileNames.join(', ')}`,
                italics: true
              })
            ]
          })
        );
      }

      // Add blank line
      sections.push(new Paragraph({ text: '' }));
    });

    // Add footer
    sections.push(
      new Paragraph({
        text: `Total messages: ${messages.length}`,
        alignment: 'center'
      })
    );

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: sections
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);
    return buffer;

  } catch (error) {
    throw error;
  }
}

// Generate Excel
async function generateExcel(messages) {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Chat Export');

    // Set up columns
    worksheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 30 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Message', key: 'message', width: 60 },
      { header: 'Attached Files', key: 'attachedFiles', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Add messages
    messages.forEach(msg => {
      const timestamp = msg.timestamp ? new Date(msg.timestamp) : null;
      const dateStr = timestamp ? formatHumanReadableDate(timestamp) : 'Unknown date';
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const attachedFiles = (msg.fileNames && msg.fileNames.length > 0) ? msg.fileNames.join(', ') : '';

      worksheet.addRow({
        timestamp: dateStr,
        role: role,
        message: msg.content || '',
        attachedFiles: attachedFiles
      });
    });

    // Enable text wrapping for Message column
    worksheet.getColumn('message').alignment = { wrapText: true, vertical: 'top' };

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;

  } catch (error) {
    throw error;
  }
}

// POST /api/export - Export conversation endpoint
router.post('/export', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    // Validate request body
    const { messages, format, filename } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid messages data'
      });
    }

    if (!format || !['pdf', 'docx', 'xlsx'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be one of: pdf, docx, xlsx'
      });
    }

    if (typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename'
      });
    }

    // Sanitize filename
    let sanitizedFilename = sanitizeFilename(filename);
    if (!sanitizedFilename) {
      sanitizedFilename = 'chat-export';
    }

    // Generate timestamp
    const timestamp = generateTimestamp();

    // Get file extension
    const extensions = {
      pdf: 'pdf',
      docx: 'docx',
      xlsx: 'xlsx'
    };
    const extension = extensions[format];

    // Generate full filename
    const fullFilename = `${sanitizedFilename}-${timestamp}.${extension}`;

    // Generate file based on format
    let buffer;
    let contentType;

    if (format === 'pdf') {
      buffer = await generatePDF(messages);
      contentType = 'application/pdf';
    } else if (format === 'docx') {
      buffer = await generateDOCX(messages);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (format === 'xlsx') {
      buffer = await generateExcel(messages);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fullFilename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send file
    res.send(buffer);

  } catch (error) {
    console.error('Export error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to generate export file'
    });
  }
});

module.exports = router;
