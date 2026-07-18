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
            pages INTEGER DEFAULT 10,
            status TEXT DEFAULT 'Ready to Print',
            uploadedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) {
            console.error('Error creating documents table:', err.message);
        } else {
            // Alter documents table to add pages column in case it was created without it
            db.run('ALTER TABLE documents ADD COLUMN pages INTEGER DEFAULT 10', (alterErr) => {
                // Ignore error if column already exists
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                    console.warn('Document pages column alter warning:', alterErr.message);
                }
            });
        }
    });

    // Create print_orders table
    db.run(`
        CREATE TABLE IF NOT EXISTS print_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            documentId INTEGER,
            documentName TEXT NOT NULL,
            copies INTEGER DEFAULT 1,
            colorMode TEXT DEFAULT 'Black & White',
            duplex TEXT DEFAULT 'Single-Sided',
            orientation TEXT DEFAULT 'Portrait',
            paperSize TEXT DEFAULT 'A4',
            pageRange TEXT DEFAULT 'All',
            printerTerminal TEXT NOT NULL,
            estimatedCost REAL DEFAULT 0.0,
            pages INTEGER DEFAULT 1,
            paymentMethod TEXT NOT NULL,
            status TEXT DEFAULT 'Pending',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating print_orders table:', err.message);
    });

    // Create transactions table
    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            referenceId TEXT UNIQUE NOT NULL,
            type TEXT NOT NULL,
            amount REAL DEFAULT 0.0,
            status TEXT DEFAULT 'Success',
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        )
    `, (err) => {
        if (err) console.error('Error creating transactions table:', err.message);
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

    // Generate random page count between 5 and 45
    const pages = Math.floor(Math.random() * 41) + 5;

    const sql = `
        INSERT INTO documents (userId, fileName, fileSize, fileUrl, pages)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.run(sql, [userId, fileName, fileSize, url, pages], function (err) {
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

// 5. Delete a document (SCRUM-35)
app.delete('/api/documents/:id', authenticateToken, (req, res) => {
    const docId = req.params.id;
    const userId = req.user.id;

    const sql = `DELETE FROM documents WHERE id = ? AND userId = ?`;
    db.run(sql, [docId, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Document not found or access denied.' });
        }
        res.json({
            message: 'Document deleted successfully from database.'
        });
    });
});// Helper to parse page range (SCRUM-50)
function parsePageRangeCount(rangeStr, docPages) {
    const clean = (rangeStr || '').trim().toLowerCase();
    if (!clean || clean === 'all') return docPages;
    
    let total = 0;
    const parts = clean.split(',');
    for (let part of parts) {
        part = part.trim();
        if (!part) continue;
        
        const rangeMatch = part.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);
            if (start > 0 && end >= start && start <= docPages && end <= docPages) {
                total += (end - start + 1);
            } else {
                return -1;
            }
        } else if (/^\d+$/.test(part)) {
            const single = parseInt(part);
            if (single > 0 && single <= docPages) {
                total += 1;
            } else {
                return -1;
            }
        } else {
            return -1;
        }
    }
    return total > 0 ? total : -1;
}


// 6. Place Print Order (SCRUM-44)
app.post('/api/print-orders', authenticateToken, (req, res) => {
    const { documentId, documentName, copies, colorMode, duplex, orientation, paperSize, pageRange, printerTerminal, estimatedCost, pages, paymentMethod } = req.body;
    const userId = req.user.id;

    if (!documentName || !printerTerminal || !paymentMethod) {
        return res.status(400).json({ error: 'Missing required print order fields.' });
    }

    // Secure calculation of print pages and cost from DB (SCRUM-50)
    db.get('SELECT * FROM documents WHERE id = ?', [documentId], (err, doc) => {
        if (err) return res.status(500).json({ error: 'Database error fetching document: ' + err.message });
        const docPages = doc ? doc.pages : 10;

        const parsedPages = parsePageRangeCount(pageRange, docPages);
        if (parsedPages === -1) {
            return res.status(400).json({ error: 'Invalid page range specified.' });
        }

        if (parseInt(pages) !== parsedPages) {
            return res.status(400).json({ error: 'Page count validation mismatch.' });
        }

        const isColor = colorMode === 'Color';
        const isDuplex = duplex === 'Double-Sided';
        let unitCost = isColor ? (isDuplex ? 4.0 : 5.0) : (isDuplex ? 1.5 : 2.0);
        if (paperSize === 'Legal') {
            unitCost += 1.0;
        }

        const calculatedCost = parsedPages * copies * unitCost;
        if (Math.abs(parseFloat(estimatedCost) - calculatedCost) > 0.01) {
            return res.status(400).json({ error: 'Estimated print cost validation mismatch.' });
        }

        // Validate user balance/quota and execute deductions
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
            if (!user) return res.status(404).json({ error: 'User not found.' });

            const totalOrderPages = parsedPages * copies;

            if (paymentMethod === 'Quota') {
                const quotaLeft = user.totalPages - user.usedPages;
                if (quotaLeft < totalOrderPages) {
                    return res.status(400).json({ error: 'Insufficient print quota.' });
                }
                
                const newUsedPages = user.usedPages + totalOrderPages;
                db.run('UPDATE users SET usedPages = ? WHERE id = ?', [newUsedPages, userId], (err) => {
                    if (err) return res.status(500).json({ error: 'Database error updating quota: ' + err.message });
                    savePrintOrder();
                });
            } else {
                if (user.walletBalance < calculatedCost) {
                    return res.status(400).json({ error: 'Insufficient wallet balance.' });
                }

                const newBalance = user.walletBalance - calculatedCost;
                db.run('UPDATE users SET walletBalance = ? WHERE id = ?', [newBalance, userId], (err) => {
                    if (err) return res.status(500).json({ error: 'Database error updating wallet: ' + err.message });
                    savePrintOrder();
                });
            }

            function savePrintOrder() {
                const sql = `
                    INSERT INTO print_orders (userId, documentId, documentName, copies, colorMode, duplex, orientation, paperSize, pageRange, printerTerminal, estimatedCost, pages, paymentMethod, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')
                `;
                db.run(sql, [userId, documentId, documentName, copies, colorMode, duplex, orientation, paperSize, pageRange, printerTerminal, calculatedCost, parsedPages, paymentMethod], function(err) {
                    if (err) return res.status(500).json({ error: 'Database error saving print order: ' + err.message });
                
                const printOrderId = this.lastID;

                if (documentId) {
                    db.run("UPDATE documents SET status = 'Processing' WHERE id = ?", [documentId]);
                }

                // Record transaction
                const txnRef = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
                const txnType = paymentMethod === 'Quota' ? 'Print Quota Debit' : 'Print Wallet Debit';
                const txnAmount = paymentMethod === 'Quota' ? 0 : estimatedCost;

                db.run(`
                    INSERT INTO transactions (userId, referenceId, type, amount, status)
                    VALUES (?, ?, ?, ?, 'Success')
                `, [userId, txnRef, txnType, txnAmount], (err) => {
                    if (err) console.error('Error logging transaction:', err.message);
                });

                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                    if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
                    const { password: _, ...userWithoutPassword } = updatedUser;
                    res.status(201).json({
                        message: 'Print order placed successfully.',
                        printOrderId,
                        student: userWithoutPassword
                    });
                });
            });
        }
    });
});

// 7. Get student's print orders
app.get('/api/print-orders', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM print_orders WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
        res.json(rows);
    });
});

// 8. Get student's transaction history
app.get('/api/transactions', authenticateToken, (req, res) => {
    const userId = req.user.id;
    db.all('SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
        res.json(rows);
    });
});

// 9. Wallet Top-up (Testing Route)
app.post('/api/wallet/topup', authenticateToken, (req, res) => {
    const { amount } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid top-up amount.' });
    }

    db.get('SELECT walletBalance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const newBalance = user.walletBalance + amount;
        db.run('UPDATE users SET walletBalance = ? WHERE id = ?', [newBalance, userId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error: ' + err.message });

            const txnRef = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
            db.run(`
                INSERT INTO transactions (userId, referenceId, type, amount, status)
                VALUES (?, ?, 'Wallet Top-up Credit', ?, 'Success')
            `, [userId, txnRef, amount], (err) => {
                if (err) console.error('Error logging transaction:', err.message);
            });

            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
                const { password: _, ...userWithoutPassword } = updatedUser;
                res.json({
                    message: 'Wallet topped up successfully.',
                    student: userWithoutPassword
                });
            });
        });
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
