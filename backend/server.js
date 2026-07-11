const express = require('express');
const cors = require('cors');
const path = require('path');
const loginRoutes = require('./routes/login');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', loginRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Campus Print System API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
