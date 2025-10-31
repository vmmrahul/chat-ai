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

// State
let conversationHistory = [];
let selectedFiles = [];
let isSending = false;

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

  // Validate: message or file must be provided
  if (!message && !selectedFile) {
    showError('Please enter a message or attach a file');
    return;
  }

  // Prevent multiple submissions
  isSending = true;
  sendButton.disabled = true;
  sendButton.textContent = 'Sending...';

  // Create user message object
  const userMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
    fileName: selectedFile ? selectedFile.name : null
  };

  // Add to history and render
  conversationHistory.push(userMessage);
  renderMessage('user', message, userMessage.fileName);
  saveConversationHistory();

  // Clear inputs
  messageInput.value = '';
  messageInput.style.height = 'auto';
  const fileToSend = selectedFile;
  handleRemoveFile();

  // Show typing indicator
  typingIndicator.style.display = 'flex';
  scrollToBottom();

  try {
    // Prepare FormData
    const formData = new FormData();
    formData.append('message', message);
    if (fileToSend) {
      formData.append('file', fileToSend);
    }

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

    // Show file indicator if file was attached
    if (fileNameStr) {
      const fileIndicator = document.createElement('div');
      fileIndicator.classList.add('message-file-indicator');
      fileIndicator.textContent = `📎 ${fileNameStr}`;
      messageDiv.appendChild(fileIndicator);
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

// Show warning if localStorage not available
if (!isLocalStorageAvailable()) {
  console.warn('localStorage not available. Chat history will not persist.');
  showError('Chat history will not be saved (localStorage unavailable)');
}
