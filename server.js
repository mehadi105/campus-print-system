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
            status TEXT DEFAULT 'Active',
            role TEXT DEFAULT 'Student'
        )
    `, (err) => {
        if (err) {
            console.error('Error creating users table:', err.message);
        } else {
            // Alter users table to add role column in case it already exists
            db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'Student'", (alterErr) => {
                seedAdminUser();
            });
        }
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
        if (err) {
            console.error('Error creating transactions table:', err.message);
        } else {
            // Create printers table (SCRUM-58)
            db.run(`
                CREATE TABLE IF NOT EXISTS printers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    location TEXT NOT NULL,
                    status TEXT DEFAULT 'Online',
                    paperCount INTEGER DEFAULT 500
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating printers table:', err.message);
                } else {
                    seedPrinters();
                }
            });
        }
    });
}

// Seeding and Admin Helper functions (SCRUM-58)
function seedAdminUser() {
    const adminRollId = 'admin';
    db.get('SELECT * FROM users WHERE rollId = ?', [adminRollId], (err, row) => {
        if (err) return console.error('Error checking admin user:', err.message);
        if (!row) {
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(`
                INSERT INTO users (fullName, rollId, department, email, session, semester, password, role)
                VALUES ('Admin Office', 'admin', 'Administration', 'admin@campusprint.com', 'N/A', 'N/A', ?, 'Admin')
            `, [hashedPassword], (err) => {
                if (err) {
                    console.error('Error seeding admin user:', err.message);
                } else {
                    console.log('Seeded default admin user: rollId="admin", password="admin123"');
                }
            });
        }
    });
}

function seedPrinters() {
    const defaultPrinters = [
        { name: 'Central Library - T1', location: 'Central Library, Ground Floor' },
        { name: 'CSE Lab - T2', location: 'CSE Dept, 3rd Floor' },
        { name: 'Science Building - T3', location: 'Science Building Lobby' }
    ];

    defaultPrinters.forEach(p => {
        db.get('SELECT * FROM printers WHERE name = ?', [p.name], (err, row) => {
            if (err) return console.error('Error checking printer:', err.message);
            if (!row) {
                db.run('INSERT INTO printers (name, location, status, paperCount) VALUES (?, ?, "Online", 500)', [p.name, p.location]);
            }
        });
    });
}

// Admin Authorization Middleware (SCRUM-58)
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
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
            { id: user.id, email: user.email, rollId: user.rollId, role: user.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Remove password from returned user object
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            token,
            student: userWithoutPassword,
            role: user.role
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

            // Account status constraint check (SCRUM-62)
            if (user.status === 'Suspended') {
                return res.status(403).json({ error: 'Your student account has been suspended by administration. Order blocked.' });
            }

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

// 7.5 Cancel Print Order (SCRUM-53)
app.post('/api/print-orders/:id/cancel', authenticateToken, (req, res) => {
    const orderId = req.params.id;
    const userId = req.user.id;

    // Fetch print order to check authorization and status
    db.get('SELECT * FROM print_orders WHERE id = ? AND userId = ?', [orderId, userId], (err, order) => {
        if (err) return res.status(500).json({ error: 'Database error fetching order: ' + err.message });
        if (!order) return res.status(404).json({ error: 'Print order not found.' });

        if (order.status !== 'Pending' && order.status !== 'Submitted') {
            return res.status(400).json({ error: 'Only pending or submitted print orders can be cancelled.' });
        }

        // Update print order status to Cancelled
        db.run("UPDATE print_orders SET status = 'Cancelled' WHERE id = ?", [orderId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error cancelling print order: ' + err.message });

            // Restore document status if applicable
            if (order.documentId) {
                db.run("UPDATE documents SET status = 'Ready to Print' WHERE id = ?", [order.documentId]);
            }

            // Fetch current user details to execute refund
            db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) return res.status(500).json({ error: 'Database error fetching user: ' + err.message });
                if (!user) return res.status(404).json({ error: 'User not found.' });

                const refundPages = order.pages * order.copies;
                const refundCost = order.estimatedCost;

                if (order.paymentMethod === 'Quota') {
                    // Refund quota
                    const newUsedPages = Math.max(user.usedPages - refundPages, 0);
                    db.run('UPDATE users SET usedPages = ? WHERE id = ?', [newUsedPages, userId], (err) => {
                        if (err) console.error('Error refunding pages quota:', err.message);
                        logCancelTransaction();
                    });
                } else {
                    // Refund wallet balance
                    const newBalance = user.walletBalance + refundCost;
                    db.run('UPDATE users SET walletBalance = ? WHERE id = ?', [newBalance, userId], (err) => {
                        if (err) console.error('Error refunding wallet balance:', err.message);
                        logCancelTransaction();
                    });
                }

                function logCancelTransaction() {
                    const txnRef = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
                    const txnType = order.paymentMethod === 'Quota' ? 'Print Quota Refund' : 'Print Wallet Refund';
                    const txnAmount = order.paymentMethod === 'Quota' ? 0 : refundCost;

                    // Log credit transaction
                    db.run(`
                        INSERT INTO transactions (userId, referenceId, type, amount, status)
                        VALUES (?, ?, ?, ?, 'Success')
                    `, [userId, txnRef, txnType, txnAmount], (err) => {
                        if (err) console.error('Error logging refund transaction:', err.message);

                        // Return updated student profile data
                        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, updatedUser) => {
                            if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
                            const { password: _, ...userWithoutPassword } = updatedUser;
                            res.json({
                                message: 'Print order cancelled and refunded successfully.',
                                orderId: orderId,
                                student: userWithoutPassword
                            });
                        });
                    });
                }
            });
        });
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


// ── ADMINISTRATOR ENDPOINTS (SCRUM-58) ──

// 1. Get Admin Dashboard Stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    const stats = {
        activeJobs: 0,
        completedJobs: 0,
        totalRevenue: 0.0,
        studentCount: 0
    };

    db.get("SELECT COUNT(*) as cnt FROM print_orders WHERE status IN ('Pending', 'Processing', 'Submitted')", (err, activeRow) => {
        if (err) return res.status(500).json({ error: 'Stats database error: ' + err.message });
        stats.activeJobs = activeRow.cnt;

        db.get("SELECT COUNT(*) as cnt FROM print_orders WHERE status = 'Completed'", (err, completedRow) => {
            if (err) return res.status(500).json({ error: 'Stats database error: ' + err.message });
            stats.completedJobs = completedRow.cnt;

            db.get("SELECT SUM(estimatedCost) as total FROM print_orders WHERE paymentMethod = 'Wallet' AND status = 'Completed'", (err, revenueRow) => {
                if (err) return res.status(500).json({ error: 'Stats database error: ' + err.message });
                stats.totalRevenue = revenueRow.total || 0;

                db.get("SELECT COUNT(*) as cnt FROM users WHERE role = 'Student'", (err, studentRow) => {
                    if (err) return res.status(500).json({ error: 'Stats database error: ' + err.message });
                    stats.studentCount = studentRow.cnt;
                    
                    res.json(stats);
                });
            });
        });
    });
});

// 2. Get All Print Orders (for Admin Queue)
app.get('/api/admin/print-orders', authenticateToken, requireAdmin, (req, res) => {
    const sql = `
        SELECT print_orders.*, users.fullName, users.rollId
        FROM print_orders
        JOIN users ON print_orders.userId = users.id
        ORDER BY print_orders.createdAt DESC
    `;
    db.all(sql, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching admin queue: ' + err.message });
        res.json(rows);
    });
});

// 3. Update Print Job Status (Process, Complete, Reject)
app.post('/api/admin/print-orders/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body; // 'Processing', 'Completed', 'Rejected'

    if (!status) return res.status(400).json({ error: 'Please provide status.' });

    // Fetch order to check details
    db.get('SELECT * FROM print_orders WHERE id = ?', [orderId], (err, order) => {
        if (err) return res.status(500).json({ error: 'Database error finding order: ' + err.message });
        if (!order) return res.status(404).json({ error: 'Print order not found.' });

        const previousStatus = order.status;

        // Perform state update
        db.run('UPDATE print_orders SET status = ? WHERE id = ?', [status, orderId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating status: ' + err.message });

            // Handle Rejection Refund logic
            if (status === 'Rejected' && previousStatus !== 'Rejected' && previousStatus !== 'Cancelled') {
                const refundPages = order.pages * order.copies;
                const refundCost = order.estimatedCost;
                const userId = order.userId;

                db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
                    if (err || !user) return console.error('Error fetching student for admin refund');

                    if (order.paymentMethod === 'Quota') {
                        const newUsed = Math.max(user.usedPages - refundPages, 0);
                        db.run('UPDATE users SET usedPages = ? WHERE id = ?', [newUsed, userId]);
                    } else {
                        const newBal = user.walletBalance + refundCost;
                        db.run('UPDATE users SET walletBalance = ? WHERE id = ?', [newBal, userId]);
                    }

                    // Log transaction entry
                    const txnRef = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
                    const txnType = order.paymentMethod === 'Quota' ? 'Admin Quota Refund' : 'Admin Wallet Refund';
                    const txnAmt = order.paymentMethod === 'Quota' ? 0 : refundCost;

                    db.run(`
                        INSERT INTO transactions (userId, referenceId, type, amount, status)
                        VALUES (?, ?, ?, ?, 'Success')
                    `, [userId, txnRef, txnType, txnAmt]);
                });
            }

            res.json({ message: `Print order status updated to ${status} successfully.` });
        });
    });
});

// 3.5 Reroute Print Order to a different terminal (SCRUM-59)
app.post('/api/admin/print-orders/:id/reroute', authenticateToken, requireAdmin, (req, res) => {
    const orderId = req.params.id;
    const { printerTerminal } = req.body;

    if (!printerTerminal) return res.status(400).json({ error: 'Please specify printerTerminal.' });

    db.get('SELECT * FROM print_orders WHERE id = ?', [orderId], (err, order) => {
        if (err) return res.status(500).json({ error: 'Database error finding print order: ' + err.message });
        if (!order) return res.status(404).json({ error: 'Print order not found.' });

        db.run('UPDATE print_orders SET printerTerminal = ? WHERE id = ?', [printerTerminal, orderId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating terminal assignment: ' + err.message });
            res.json({ message: `Print order successfully rerouted to ${printerTerminal}.` });
        });
    });
});

// 4. Get Registered Students
app.get('/api/admin/students', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT id, fullName, rollId, department, email, session, semester, walletBalance, usedPages, totalPages, status FROM users WHERE role = 'Student'", (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching students: ' + err.message });
        res.json(rows);
    });
});

// 5. Adjust Student Balance/Quota
app.post('/api/admin/students/:id/adjust', authenticateToken, requireAdmin, (req, res) => {
    const studentId = req.params.id;
    const { amount, quotaAdjustment } = req.body; // e.g. amount = 500, quotaAdjustment = 50

    db.get('SELECT * FROM users WHERE id = ? AND role = "Student"', [studentId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error finding student: ' + err.message });
        if (!user) return res.status(404).json({ error: 'Student not found.' });

        let updatedBalance = user.walletBalance;
        let updatedTotalPages = user.totalPages;

        let logTxns = [];

        if (amount && amount !== 0) {
            updatedBalance += amount;
            logTxns.push({
                type: 'Admin Cash Top-up',
                amount: amount
            });
        }

        if (quotaAdjustment && quotaAdjustment !== 0) {
            updatedTotalPages += quotaAdjustment;
            logTxns.push({
                type: 'Admin Quota Adjustment',
                amount: 0
            });
        }

        db.run('UPDATE users SET walletBalance = ?, totalPages = ? WHERE id = ?', [updatedBalance, updatedTotalPages, studentId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error adjusting student account: ' + err.message });

            // Log transactions
            logTxns.forEach(t => {
                const txnRef = 'TXN-' + Math.floor(10000 + Math.random() * 90000);
                db.run(`
                    INSERT INTO transactions (userId, referenceId, type, amount, status)
                    VALUES (?, ?, ?, ?, 'Success')
                `, [studentId, txnRef, t.type, t.amount]);
            });

            res.json({ message: 'Student account adjusted successfully.' });
        });
    });
});

// 5.3 Update Student Status (Suspend/Activate) (SCRUM-62)
app.post('/api/admin/students/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const studentId = req.params.id;
    const { status } = req.body; // 'Active' / 'Suspended'

    if (!status) return res.status(400).json({ error: 'Please specify status.' });

    db.get('SELECT * FROM users WHERE id = ? AND role = "Student"', [studentId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error finding student: ' + err.message });
        if (!user) return res.status(404).json({ error: 'Student not found.' });

        db.run('UPDATE users SET status = ? WHERE id = ?', [status, studentId], (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating student status: ' + err.message });
            res.json({ message: `Student status successfully updated to ${status}.` });
        });
    });
});

// 5.6 Get Student Transactions history ledger (SCRUM-62)
app.get('/api/admin/students/:id/transactions', authenticateToken, requireAdmin, (req, res) => {
    const studentId = req.params.id;

    db.all('SELECT * FROM transactions WHERE userId = ? ORDER BY createdAt DESC', [studentId], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching transactions: ' + err.message });
        res.json(rows);
    });
});

// 6. Get Printer Terminals
app.get('/api/admin/printers', authenticateToken, requireAdmin, (req, res) => {
    db.all('SELECT * FROM printers', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error fetching printers: ' + err.message });
        res.json(rows);
    });
});

// 7. Update Printer Status
app.post('/api/admin/printers/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const printerId = req.params.id;
    const { status, paperCount } = req.body; // status: 'Online' / 'Offline', paperCount: optional integer

    db.get('SELECT * FROM printers WHERE id = ?', [printerId], (err, printer) => {
        if (err) return res.status(500).json({ error: 'Database error finding printer: ' + err.message });
        if (!printer) return res.status(404).json({ error: 'Printer terminal not found.' });

        let sql = 'UPDATE printers SET ';
        const params = [];
        if (status) {
            sql += 'status = ?, ';
            params.push(status);
        }
        if (paperCount !== undefined) {
            sql += 'paperCount = ?, ';
            params.push(paperCount);
        }

        // Clean final comma
        sql = sql.slice(0, -2) + ' WHERE id = ?';
        params.push(printerId);

        db.run(sql, params, (err) => {
            if (err) return res.status(500).json({ error: 'Database error updating printer: ' + err.message });
            res.json({ message: 'Printer terminal status updated successfully.' });
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
