// Chat Application JavaScript

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const fileInput = document.getElementById('fileInput');
const attachFileBtn = document.getElementById('attachFileBtn');
const filePreview = document.getElementById('filePreview');
const filesCountDisplay = document.getElementById('filesCountDisplay');
const filesList = document.getElementById('filesList');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const typingIndicator = document.getElementById('typingIndicator');
const errorMessage = document.getElementById('errorMessage');

// Export Modal Elements
const exportBtn = document.getElementById('exportBtn');
const exportModal = document.getElementById('exportModal');
const formatSelectionStep = document.getElementById('formatSelectionStep');
const nameCustomizationStep = document.getElementById('nameCustomizationStep');
const nameStepTitle = document.getElementById('nameStepTitle');
const customFileName = document.getElementById('customFileName');
const filenamePreview = document.getElementById('filenamePreview');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const backToFormatsBtn = document.getElementById('backToFormatsBtn');
const confirmExportBtn = document.getElementById('confirmExportBtn');
const formatButtons = document.querySelectorAll('.format-btn');

// State
let conversationHistory = [];
let selectedFiles = [];
let isSending = false;
let selectedExportFormat = null;

// Constants
const STORAGE_KEY = 'chatHistory';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadConversationHistory();
  setupEventListeners();

  // Auto-resize textarea
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';
  });
});

// Setup Event Listeners
function setupEventListeners() {
  sendButton.addEventListener('click', handleSendMessage);

  // Handle Enter key (Shift+Enter for new line, Enter to send)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  attachFileBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', handleFileSelection);
  clearFilesBtn.addEventListener('click', handleClearAllFiles);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
}

// Load conversation history from localStorage
function loadConversationHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      conversationHistory = JSON.parse(stored);

      // Render all messages (handle both old fileName and new fileNames formats)
      conversationHistory.forEach(msg => {
        const fileNames = msg.fileNames || (msg.fileName ? [msg.fileName] : null);
        renderMessage(msg.role, msg.content, fileNames);
      });

      scrollToBottom();
    }
  } catch (error) {
    console.error('Failed to load conversation history:', error);
    // If localStorage is corrupted, reset it
    conversationHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    showError('Chat history reset due to data corruption');
  }
}

// Save conversation history to localStorage
function saveConversationHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
  } catch (error) {
    console.error('Failed to save conversation history:', error);

    // If quota exceeded, trim history
    if (error.name === 'QuotaExceededError') {
      conversationHistory = conversationHistory.slice(-20);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
        showError('Chat history trimmed to save space');
      } catch (e) {
        showError('Unable to save chat history');
      }
    }
  }
}

// Handle file selection
function handleFileSelection(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.docx'];
  let validFilesAdded = false;

  // Process each selected file
  Array.from(files).forEach(file => {
    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showError(`${file.name} exceeds 5MB limit. Skipped.`);
      return;
    }

    // Validate file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      showError(`${file.name} not supported. Skipped.`);
      return;
    }

    // Create file metadata object
    const fileMetadata = {
      id: Date.now() + Math.random(), // Unique ID for removal
      file: file,
      name: file.name,
      size: file.size,
      type: file.type,
      isImage: file.type.startsWith('image/')
    };

    selectedFiles.push(fileMetadata);
    validFilesAdded = true;
  });

  // Update preview if any valid files were added
  if (validFilesAdded) {
    updateFilePreview();
  }

  // Don't clear file input on success - user can add more files
}

// Get file icon based on file type
function getFileIcon(fileMetadata) {
  const ext = '.' + fileMetadata.name.split('.').pop().toLowerCase();

  if (fileMetadata.isImage) {
    return '🖼️';
  } else if (ext === '.pdf') {
    return '📕';
  } else if (ext === '.docx') {
    return '📘';
  } else if (ext === '.txt') {
    return '📄';
  }
  return '📎';
}

// Update file preview list
function updateFilePreview() {
  // Update count display
  filesCountDisplay.textContent = `Files Selected (${selectedFiles.length})`;

  // Clear file list
  filesList.innerHTML = '';

  // Add each file as a list item
  selectedFiles.forEach(fileMetadata => {
    const fileItem = document.createElement('div');
    fileItem.classList.add('file-item');
    fileItem.setAttribute('data-file-id', fileMetadata.id);

    // File icon
    const icon = document.createElement('div');
    icon.classList.add('file-icon');
    icon.textContent = getFileIcon(fileMetadata);

    // File info
    const info = document.createElement('div');
    info.classList.add('file-info');

    const nameDiv = document.createElement('div');
    nameDiv.classList.add('file-name');
    nameDiv.textContent = fileMetadata.name;

    const sizeDiv = document.createElement('div');
    sizeDiv.classList.add('file-size');
    sizeDiv.textContent = formatFileSize(fileMetadata.size);

    info.appendChild(nameDiv);
    info.appendChild(sizeDiv);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.classList.add('btn-remove');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      handleRemoveFileById(fileMetadata.id);
    });

    fileItem.appendChild(icon);
    fileItem.appendChild(info);
    fileItem.appendChild(removeBtn);

    filesList.appendChild(fileItem);
  });

  // Show or hide preview container
  if (selectedFiles.length > 0) {
    filePreview.style.display = 'flex';
  } else {
    filePreview.style.display = 'none';
  }
}

// Remove file by ID
function handleRemoveFileById(fileId) {
  selectedFiles = selectedFiles.filter(f => f.id !== fileId);
  updateFilePreview();
}

// Clear all files
function handleClearAllFiles() {
  selectedFiles = [];
  fileInput.value = '';
  updateFilePreview();
}

// Handle send message
async function handleSendMessage() {
  if (isSending) return;

  const message = messageInput.value.trim();

  // Validate: message or files must be provided
  if (!message && selectedFiles.length === 0) {
    showError('Please enter a message or attach a file');
    return;
  }

  // Prevent multiple submissions
  isSending = true;
  sendButton.disabled = true;
  sendButton.textContent = 'Sending...';

  // Copy files array before clearing
  const filesToSend = [...selectedFiles];

  // Create user message object
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
    fileNames: filesToSend.length > 0 ? filesToSend.map(f => f.name) : null
  };

  // Add to history and render
  conversationHistory.push(userMessage);
  renderMessage('user', message, userMessage.fileNames);
  saveConversationHistory();

  // Clear inputs
  messageInput.value = '';
  messageInput.style.height = 'auto';
  handleClearAllFiles();

  // Show typing indicator
  typingIndicator.style.display = 'flex';
  scrollToBottom();

  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append('message', message);

    // Append all files
    filesToSend.forEach((fileMetadata) => {
      formData.append('file', fileMetadata.file);
    });

    // Prepare conversation history for API (only content and role, last 10 messages)
    const historyForAPI = conversationHistory
      .slice(-10)
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    formData.append('conversationHistory', JSON.stringify(historyForAPI));

    // Send request
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    // Hide typing indicator
    typingIndicator.style.display = 'none';

    if (data.success) {
      // Create AI message object
      const aiMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: Date.now()
      };

      // Add to history and render
      conversationHistory.push(aiMessage);
      renderMessage('assistant', data.message);
      saveConversationHistory();
      scrollToBottom();
    } else {
      // Show error from server
      showError(data.error || 'An error occurred');
    }

  } catch (error) {
    console.error('Request error:', error);
    typingIndicator.style.display = 'none';

    // Check if network error
    if (!navigator.onLine) {
      showError('Network error. Please check your connection');
    } else {
      showError('Failed to send message. Please try again');
    }
  } finally {
    // Re-enable send button
    isSending = false;
    sendButton.disabled = false;
    sendButton.textContent = 'Send';
  }
}

// Render message in chat
function renderMessage(role, content, fileNameStr = null) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');

  if (role === 'user') {
    messageDiv.classList.add('user-message');

    // Show file indicators if files were attached
    if (fileNameStr) {
      const filesIndicator = document.createElement('div');
      filesIndicator.classList.add('message-files-indicator');

      // Handle both string (old format) and array (new format) for compatibility
      const fileNames = Array.isArray(fileNameStr) ? fileNameStr : [fileNameStr];

      fileNames.forEach(name => {
        const indicator = document.createElement('div');
        indicator.classList.add('message-file-badge');
        indicator.textContent = `📎 ${name}`;
        filesIndicator.appendChild(indicator);
      });

      messageDiv.appendChild(filesIndicator);
    }

    // Add message content (only if not empty)
    if (content) {
      const contentDiv = document.createElement('div');
      contentDiv.classList.add('message-content');
      contentDiv.textContent = content;
      messageDiv.appendChild(contentDiv);
    }
  } else {
    messageDiv.classList.add('ai-message');

    // Add AI label
    const label = document.createElement('span');
    label.classList.add('ai-label');
    label.textContent = 'AI:';
    messageDiv.appendChild(label);

    // Add message content
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = content;
    messageDiv.appendChild(contentDiv);
  }

  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

// Scroll to bottom of chat
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 5000);
}

// Clear conversation history
function handleClearHistory() {
  const confirmed = confirm('Are you sure you want to clear all chat history?');

  if (confirmed) {
    conversationHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    chatMessages.innerHTML = '';

    // Show brief confirmation
    showError('Chat history cleared');
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 2000);
  }
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Check if localStorage is available
function isLocalStorageAvailable() {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

// ===== EXPORT FUNCTIONALITY =====

// Open export modal
function openExportModal() {
  // Check if there's any conversation history
  const history = localStorage.getItem(STORAGE_KEY);
  if (!history || JSON.parse(history).length === 0) {
    showError('No conversation to export. Start chatting to create history.');
    return;
  }

  // Show modal
  exportModal.style.display = 'flex';

  // Ensure Step 1 is visible, Step 2 is hidden
  formatSelectionStep.style.display = 'block';
  nameCustomizationStep.style.display = 'none';

  // Reset custom filename to default
  customFileName.value = 'chat-export';
  selectedExportFormat = null;

  // Add overlay click listener
  exportModal.addEventListener('click', handleOverlayClick);

  // Add escape key listener
  document.addEventListener('keydown', handleEscapeKey);
}

// Close export modal
function closeExportModal() {
  exportModal.style.display = 'none';

  // Reset to Step 1
  formatSelectionStep.style.display = 'block';
  nameCustomizationStep.style.display = 'none';

  // Clear selected format
  selectedExportFormat = null;

  // Remove event listeners
  exportModal.removeEventListener('click', handleOverlayClick);
  document.removeEventListener('keydown', handleEscapeKey);
}

// Handle overlay click (close on outside click)
function handleOverlayClick(e) {
  if (e.target === exportModal) {
    closeExportModal();
  }
}

// Handle escape key press
function handleEscapeKey(e) {
  if (e.key === 'Escape') {
    closeExportModal();
  }
}

// Show name customization step
function showNameCustomizationStep(format) {
  // Store selected format
  selectedExportFormat = format;

  // Hide Step 1, Show Step 2
  formatSelectionStep.style.display = 'none';
  nameCustomizationStep.style.display = 'block';

  // Update modal title based on format
  const formatTitles = {
    json: 'Export as JSON',
    markdown: 'Export as Markdown',
    txt: 'Export as Plain Text',
    pdf: 'Export as PDF',
    docx: 'Export as Word',
    xlsx: 'Export as Excel'
  };
  nameStepTitle.textContent = formatTitles[format] || 'Export';

  // Set focus to filename input
  customFileName.focus();
  customFileName.select();

  // Update preview
  updateFilenamePreview();
}

// Back to format selection
function backToFormatSelection() {
  // Hide Step 2, Show Step 1
  nameCustomizationStep.style.display = 'none';
  formatSelectionStep.style.display = 'block';

  // Clear selected format
  selectedExportFormat = null;
}

// Confirm export
function confirmExport() {
  // Get custom filename and sanitize
  let baseName = customFileName.value.trim();
  baseName = sanitizeFilename(baseName);

  // If empty after sanitization, use default
  if (!baseName) {
    baseName = 'chat-export';
  }

  // Call export function with format and custom filename
  exportConversation(selectedExportFormat, baseName);
}

// Sanitize filename (remove invalid characters)
function sanitizeFilename(filename) {
  // Remove invalid filename characters: / \ : * ? " < > |
  return filename.replace(/[/\\:*?"<>|]/g, '').trim();
}

// Generate filename with timestamp
function generateFilename(baseName, format) {
  // Generate timestamp in format YYYY-MM-DD-HHMMSS
  const timestamp = new Date().toISOString().replace(/:/g, '').replace(/\..+/, '').replace('T', '-');

  // Get extension based on format
  const extensions = {
    json: 'json',
    markdown: 'md',
    txt: 'txt',
    pdf: 'pdf',
    docx: 'docx',
    xlsx: 'xlsx'
  };

  const extension = extensions[format] || 'txt';

  return `${baseName}-${timestamp}.${extension}`;
}

// Update filename preview in real-time
function updateFilenamePreview() {
  let baseName = customFileName.value.trim();
  baseName = sanitizeFilename(baseName);

  // If empty, use default
  if (!baseName) {
    baseName = 'chat-export';
  }

  // Truncate if too long (>200 characters)
  if (baseName.length > 200) {
    baseName = baseName.substring(0, 200);
  }

  // Generate full filename preview
  const fullFilename = generateFilename(baseName, selectedExportFormat);

  // Update preview text
  filenamePreview.textContent = `Will be saved as: ${fullFilename}`;
}

// Export conversation
function exportConversation(format, customFilename) {
  // Get conversation history
  const history = localStorage.getItem(STORAGE_KEY);
  if (!history) {
    showError('No conversation to export');
    return;
  }

  const chatHistory = JSON.parse(history);

  // Generate full filename
  const fullFilename = generateFilename(customFilename, format);

  // Based on format, either generate client-side or call backend
  if (format === 'json') {
    const content = generateJSON(chatHistory);
    downloadFile(content, fullFilename, 'application/json');
    closeExportModal();
  } else if (format === 'markdown') {
    const content = generateMarkdown(chatHistory);
    downloadFile(content, fullFilename, 'text/markdown');
    closeExportModal();
  } else if (format === 'txt') {
    const content = generatePlainText(chatHistory);
    downloadFile(content, fullFilename, 'text/plain');
    closeExportModal();
  } else if (format === 'pdf' || format === 'docx' || format === 'xlsx') {
    // Call backend for server-side generation
    exportViaBackend(format, customFilename);
  }
}

// Generate JSON export
function generateJSON(chatHistory) {
  const exportData = {
    exportDate: new Date().toISOString(),
    messages: chatHistory,
    messageCount: chatHistory.length
  };

  return JSON.stringify(exportData, null, 2);
}

// Generate Markdown export
function generateMarkdown(chatHistory) {
  let markdown = '# Chat Conversation\n\n';

  // Add export timestamp
  const exportDate = new Date();
  markdown += `**Exported:** ${formatHumanReadableDate(exportDate)}\n\n`;

  // Add separator
  markdown += '---\n\n';

  // Add each message
  chatHistory.forEach(msg => {
    const timestamp = msg.timestamp ? new Date(msg.timestamp) : null;
    const dateStr = timestamp ? formatHumanReadableDate(timestamp) : 'Unknown date';

    markdown += `## ${dateStr}\n`;
    markdown += `**${msg.role === 'user' ? 'User' : 'Assistant'}:**\n\n`;
    markdown += `${msg.content}\n\n`;

    // Add attached files if any
    if (msg.fileNames && msg.fileNames.length > 0) {
      markdown += `> Attached files: ${msg.fileNames.join(', ')}\n\n`;
    }
  });

  // Add footer
  markdown += `---\n\n`;
  markdown += `*Total messages: ${chatHistory.length}*\n`;

  return markdown;
}

// Generate Plain Text export
function generatePlainText(chatHistory) {
  let text = 'Chat Conversation Export\n';

  // Add export timestamp
  const exportDate = new Date();
  text += `Exported: ${formatHumanReadableDate(exportDate)}\n`;

  // Add separator
  text += '---\n\n';

  // Add each message
  chatHistory.forEach(msg => {
    const timestamp = msg.timestamp ? new Date(msg.timestamp) : null;
    const dateStr = timestamp ? formatHumanReadableDate(timestamp) : 'Unknown date';

    text += `[${dateStr}] ${msg.role === 'user' ? 'User' : 'Assistant'}:\n`;
    text += `${msg.content}\n`;

    // Add attached files if any
    if (msg.fileNames && msg.fileNames.length > 0) {
      text += `[Attached files: ${msg.fileNames.join(', ')}]\n`;
    }

    text += '\n';
  });

  // Add footer
  text += `---\n`;
  text += `Total messages: ${chatHistory.length}\n`;

  return text;
}

// Format date to human-readable format
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

// Download file (client-side)
function downloadFile(content, filename, mimeType) {
  // Create Blob
  const blob = new Blob([content], { type: mimeType });

  // Create temporary anchor element
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);

  a.href = url;
  a.download = filename;
  a.style.display = 'none';

  // Append to body, click, and remove
  document.body.appendChild(a);
  a.click();

  // Clean up
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// Export via backend (for PDF, DOCX, Excel)
async function exportViaBackend(format, customFilename) {
  // Get chat history
  const chatHistory = JSON.parse(localStorage.getItem(STORAGE_KEY));

  // Disable Download button and show loading state
  confirmExportBtn.disabled = true;
  const originalText = confirmExportBtn.textContent;
  confirmExportBtn.textContent = 'Generating...';

  try {
    // Send request to backend
    const response = await fetch('/api/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: chatHistory,
        format: format,
        filename: customFilename
      })
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    // Get blob from response
    const blob = await response.blob();

    // Extract filename from Content-Disposition header if available
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = generateFilename(customFilename, format);

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';

    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    // Close modal on success
    closeExportModal();

  } catch (error) {
    console.error('Export error:', error);
    showError('Export failed. Please try again.');
  } finally {
    // Re-enable Download button
    confirmExportBtn.disabled = false;
    confirmExportBtn.textContent = originalText;
  }
}

// Show warning if localStorage not available
if (!isLocalStorageAvailable()) {
  console.warn('localStorage not available. Chat history will not persist.');
  showError('Chat history will not be saved (localStorage unavailable)');
}
