# AI Chatbot

An AI-powered chatbot application built with Node.js, Express, and EJS, featuring OpenAI GPT-4o integration with support for text conversations, image analysis, and document processing.

## Features

- **Text Conversations**: Interactive chat with OpenAI's GPT-4o model
- **Image Analysis**: Upload images and ask questions about their content
- **Document Processing**: Upload and analyze PDF, DOCX, and TXT files
- **Persistent History**: Conversation history saved in browser localStorage
- **Real-time Interface**: Smooth chat experience with typing indicators
- **File Upload Support**: Handles multiple file types with validation
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Requirements

- Node.js 16 or higher
- OpenAI API key (get one at [platform.openai.com](https://platform.openai.com))

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
```

Replace `your_openai_api_key_here` with your actual OpenAI API key.

### 3. Start the Server

For production:
```bash
npm start
```

For development (with auto-restart):
```bash
npm run dev
```

### 4. Open in Browser

Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Text Chat
1. Type your message in the input field
2. Press Enter or click "Send"
3. Wait for the AI response

### Image Analysis
1. Click the paperclip (📎) button to attach an image
2. Select a JPG, PNG, GIF, or WEBP file (max 5MB)
3. Type a question about the image (optional)
4. Click "Send"

### Document Analysis
1. Click the paperclip (📎) button
2. Select a PDF, DOCX, or TXT file (max 5MB)
3. Ask a question about the document
4. Click "Send"

### Clear History
Click the "Clear History" button in the header to remove all conversation history.

## Supported File Types

- **Images**: JPG, JPEG, PNG, GIF, WEBP
- **Documents**: PDF, DOCX, TXT
- **Maximum file size**: 5MB

## Project Structure

```
chat-ai/
├── .env                      # Environment variables
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── package.json             # NPM dependencies
├── server.js                # Express server
├── uploads/                 # Temporary file storage (auto-created)
├── public/                  # Static files
│   ├── css/
│   │   └── style.css       # Chat interface styles
│   └── js/
│       └── chat.js         # Frontend JavaScript
├── views/                   # EJS templates
│   └── index.ejs           # Main chat page
└── routes/                  # API routes
    ├── index.js            # Home page route
    └── chat.js             # Chat API endpoint
```

## Technologies Used

- **Backend**: Node.js, Express
- **Template Engine**: EJS
- **AI Integration**: OpenAI GPT-4o API
- **File Handling**: Multer, pdf-parse, mammoth
- **Frontend**: Vanilla JavaScript, CSS3

## Error Handling

The application includes comprehensive error handling for:
- File size validation (frontend and backend)
- File type validation
- Network errors
- OpenAI API errors
- Rate limiting
- Invalid inputs

## Development

The application uses environment-based configuration. All sensitive data (API keys) are stored in `.env` and never exposed to the frontend.

Temporary uploaded files are automatically deleted after processing to prevent storage issues.

## License

ISC
