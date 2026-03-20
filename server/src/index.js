const express = require('express');
const cors = require('cors');
const { getDb } = require('./db');
const cardsRouter = require('./routes/cards');
const conversationsRouter = require('./routes/conversations');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/cards', cardsRouter);
app.use('/api/conversations', conversationsRouter);

// Initialize database on startup
getDb();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
