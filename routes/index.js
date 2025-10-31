const express = require('express');
const router = express.Router();

// Home page route - render chat interface
router.get('/', (req, res) => {
  res.render('index');
});

module.exports = router;
