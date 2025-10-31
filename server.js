require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in .env file');
  console.error('Please add your OpenAI API key to the .env file:');
  console.error('OPENAI_API_KEY=your_openai_api_key_here');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const indexRouter = require('./routes/index');
const chatRouter = require('./routes/chat');

app.use('/', indexRouter);
app.use('/api/chat', chatRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});
