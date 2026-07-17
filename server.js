const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'campus-printing-super-secret-key-12345';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

// Database schema initialization
function createTables() {
    // Create users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            rollId TEXT UNIQUE NOT NULL,
            department TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            session TEXT NOT NULL,
            semester TEXT NOT NULL,
            password TEXT NOT NULL,
            walletBalance REAL DEFAULT 1250.0,
            usedPages INTEGER DEFAULT 50,
            totalPages INTEGER DEFAULT 100,
            status TEXT DEFAULT 'Active'
        )
    `, (err) => {
        if (err) console.error('Error creating users table:', err.message);
    });

    // Create documents table (SCRUM-32)
    db.run(`
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            fileName TEXT NOT NULL,
            fileSize TEXT NOT NULL,
            fileUrl TEXT NOT NULL,
            status TEXT DEFAULT 'Ready to Print',
            uploadedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating documents table:', err.message);
    });
}

// ── JWT Authentication Middleware ──
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <TOKEN>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. Token missing.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Access denied. Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
}

// ── API ROUTES ──

// 1. User Registration
app.post('/api/auth/register', (req, res) => {
    const { fullName, rollId, department, email, session, semester, password } = req.body;

    if (!fullName || !rollId || !department || !email || !session || !semester || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = `
        INSERT INTO users (fullName, rollId, department, email, session, semester, password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [fullName, rollId, department, email.toLowerCase(), session, semester, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'User with this email or Roll ID already exists.' });
            }
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.status(201).json({ 
            message: 'User registered successfully.', 
            userId: this.lastID 
        });
    });
});

// 2. User Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Please provide both credentials and password.' });
    }

    const sql = `SELECT * FROM users WHERE email = ? OR rollId = ?`;
    db.get(sql, [email.toLowerCase(), email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (!user) {
            return res.status(400).json({ error: 'Invalid email/roll ID or password.' });
        }

        const isPasswordValid = bcrypt.compareSync(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ error: 'Invalid email/roll ID or password.' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, rollId: user.rollId },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove password from returned user object
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            token,
            student: userWithoutPassword
        });
    });
});

// 3. Document Upload (SCRUM-32)
app.post('/api/documents/upload', authenticateToken, (req, res) => {
    const { fileName, fileSize, fileUrl } = req.body;
    const userId = req.user.id;

    if (!fileName || !fileSize) {
        return res.status(400).json({ error: 'File name and file size are required.' });
    }

    // Default mock URL if not provided
    const url = fileUrl || `uploads/${Date.now()}_${fileName.replace(/\s+/g, '_')}`;

    const sql = `
        INSERT INTO documents (userId, fileName, fileSize, fileUrl)
        VALUES (?, ?, ?, ?)
    `;

    db.run(sql, [userId, fileName, fileSize, url], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }

        db.get('SELECT * FROM documents WHERE id = ?', [this.lastID], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error retrieving document: ' + err.message });
            }
            res.status(201).json({
                message: 'Document info stored successfully in database.',
                document: row
            });
        });
    });
});

// 4. Retrieve logged-in student's uploaded documents (Helper route to keep dashboard dynamic)
app.get('/api/documents', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const sql = `SELECT * FROM documents WHERE userId = ? ORDER BY uploadedAt DESC`;

    db.all(sql, [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        res.json(rows);
    });
});

// ── Serving static files ──
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
