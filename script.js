document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const message = document.getElementById('message');
    const page = document.body?.dataset?.page;

    function showMessage(text, type = 'info') {
        if (!message) return;

        message.textContent = text;
        message.style.display = 'block';
        message.style.padding = '12px 14px';
        message.style.borderRadius = '8px';
        message.style.marginBottom = '16px';
        message.style.fontWeight = '600';
        message.style.textAlign = 'center';
        message.style.color = '#fff';

        if (type === 'success') {
            message.style.backgroundColor = '#2e7d32';
        } else if (type === 'error') {
            message.style.backgroundColor = '#c62828';
        } else {
            message.style.backgroundColor = '#1976d2';
        }
    }

    function handleRegister(event) {
        if (event) event.preventDefault();

        const fullName = document.getElementById('fullName')?.value.trim();
        const rollId = document.getElementById('rollId')?.value.trim();
        const department = document.getElementById('department')?.value.trim();
        const email = document.getElementById('email')?.value.trim();
        const session = document.getElementById('session')?.value.trim();
        const semester = document.getElementById('semester')?.value.trim();
        const password = document.getElementById('password')?.value.trim();

        if (!fullName || !rollId || !department || !email || !session || !semester || !password) {
            showMessage('Please fill in all fields.', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('Password must be at least 6 characters.', 'error');
            return;
        }

        const data = { fullName, rollId, department, email, session, semester, password };

        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        .then(res => res.json().then(json => ({ ok: res.ok, body: json })))
        .then(({ ok, body }) => {
            if (!ok) {
                throw new Error(body.error || 'Registration failed.');
            }
            showMessage('Account created successfully. Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 700);
        })
        .catch(err => {
            // Local fallback if API server is offline
            console.warn('API register failed/offline. Running local storage fallback...', err);
            const student = {
                id: 999, // Dummy ID
                fullName,
                rollId,
                department,
                email: email.toLowerCase(),
                session,
                semester,
                password,
                walletBalance: 1250,
                usedPages: 50,
                totalPages: 100,
                status: 'Active'
            };
            localStorage.setItem('registeredStudent', JSON.stringify(student));
            showMessage('Registration Successful (Offline Fallback)! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        });
    }

    function handleLogin(event) {
        if (event) event.preventDefault();

        const email = document.getElementById('email')?.value.trim();
        const password = document.getElementById('password')?.value.trim();

        if (!email || !password) {
            showMessage('Please fill in both fields.', 'error');
            return;
        }

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        .then(res => res.json().then(json => ({ ok: res.ok, body: json })))
        .then(({ ok, body }) => {
            if (!ok) {
                throw new Error(body.error || 'Login failed.');
            }
            localStorage.setItem('token', body.token);
            localStorage.setItem('currentStudent', JSON.stringify(body.student));
            showMessage('Login successful. Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 700);
        })
        .catch(err => {
            // Local fallback if API is offline
            console.warn('API offline. Toggling local authentication fallback.', err);
            const registeredStudent = JSON.parse(localStorage.getItem('registeredStudent') || 'null');
            if (registeredStudent && 
                (registeredStudent.email === email.toLowerCase() || registeredStudent.rollId === email) && 
                registeredStudent.password === password) {
                localStorage.setItem('token', 'mock-jwt-token-xyz');
                localStorage.setItem('currentStudent', JSON.stringify(registeredStudent));
                showMessage('Login successful (Offline Fallback).', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 700);
            } else {
                showMessage('Invalid email/roll ID or password (Offline fallback).', 'error');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (page === 'dashboard') {
        const currentStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null');
        const logoutButton = document.getElementById('logoutBtn');
        const token = localStorage.getItem('token');

        if (!currentStudent || !token) {
            window.location.href = 'index.html';
            return;
        }

        logoutButton?.addEventListener('click', () => {
            localStorage.removeItem('currentStudent');
            localStorage.removeItem('token');
            window.location.href = 'index.html';
        });

        // ── Dynamic Tab Switching ──
        const navItems = document.querySelectorAll('.nav-links .nav-item');
        const tabContents = document.querySelectorAll('.tab-content');

        const switchTab = (targetId) => {
            // Update active nav item
            navItems.forEach(nav => {
                const href = nav.getAttribute('href');
                if (href === `#${targetId}`) {
                    nav.classList.add('active');
                } else {
                    nav.classList.remove('active');
                }
            });

            // Show active tab panel
            tabContents.forEach(tab => {
                if (tab.id === targetId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        };

        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const href = item.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const targetId = href.substring(1);
                    switchTab(targetId);
                    window.location.hash = href;
                }
            });
        });

        // Sync tab state on load and hash change
        const handleHashChange = () => {
            const hash = window.location.hash || '#dashboard-view';
            const targetId = hash.substring(1);
            const targetTab = document.getElementById(targetId);
            if (targetTab && targetTab.classList.contains('tab-content')) {
                switchTab(targetId);
            } else {
                switchTab('dashboard-view');
            }
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();

        // ── Drag & Drop File Upload Handler (SCRUM-32) ──
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const browseBtn = document.getElementById('browseBtn');
        const uploadQueue = document.getElementById('uploadQueue');

        const getFileExt = (filename) => {
            return filename.substring(filename.lastIndexOf('.')).toLowerCase();
        };

        const formatSize = (bytes) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        browseBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput?.click();
        });

        dropZone?.addEventListener('click', () => {
            fileInput?.click();
        });

        // Drag/Drop Listeners
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone?.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone?.addEventListener(eventName, () => {
                dropZone.classList.add('is-dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone?.addEventListener(eventName, () => {
                dropZone.classList.remove('is-dragover');
            }, false);
        });

        dropZone?.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        fileInput?.addEventListener('change', (e) => {
            const files = e.target.files;
            handleFiles(files);
        });

        const handleFiles = (files) => {
            if (!files.length) return;
            Array.from(files).forEach(file => {
                const ext = getFileExt(file.name);
                const allowed = ['.pdf', '.docx', '.pptx'];
                const maxSize = 25 * 1024 * 1024; // 25MB

                if (!allowed.includes(ext)) {
                    alert(`File type not allowed: ${file.name}. Only PDF, DOCX, and PPTX files are supported.`);
                    return;
                }

                if (file.size > maxSize) {
                    alert(`File size exceeds 25MB: ${file.name}`);
                    return;
                }

                uploadFile(file);
            });
        };

        const uploadFile = (file) => {
            const fileId = 'file_' + Math.random().toString(36).substr(2, 9);
            const ext = getFileExt(file.name).replace('.', '');
            const sizeStr = formatSize(file.size);

            let iconClass = 'file-icon-pdf';
            let iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>';
            if (ext === 'docx') {
                iconClass = 'file-icon-docx';
                iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM9 13h6v2H9v-2zm0 4h4v2H9v-2z"/></svg>';
            } else if (ext === 'pptx') {
                iconClass = 'file-icon-pptx';
                iconSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 11h8v2H8v-2zm0 4h6v2H8v-2z"/></svg>';
            }

            const li = document.createElement('li');
            li.className = 'queue-item';
            li.id = fileId;
            li.setAttribute('data-status', 'uploading');
            li.innerHTML = `
                <div class="queue-item-icon ${iconClass}" aria-hidden="true">
                    ${iconSvg}
                </div>
                <div class="queue-item-body">
                    <div class="queue-item-top">
                        <p class="queue-file-name" title="${file.name}">${file.name}</p>
                        <span class="queue-file-size">${sizeStr}</span>
                    </div>
                    <div class="queue-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Upload progress">
                        <div class="queue-progress-fill" style="width: 0%"></div>
                    </div>
                </div>
                <span class="queue-status status-uploading">Uploading…</span>
                <button type="button" class="queue-remove-btn" aria-label="Remove ${file.name}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/></svg>
                </button>
            `;

            // If queue list has mock static files, clear it
            if (uploadQueue.children.length === 3 && uploadQueue.innerHTML.includes('Final_Report_Draft_v3.pdf')) {
                uploadQueue.innerHTML = '';
            }
            uploadQueue.prepend(li);

            let progress = 0;
            const progressFill = li.querySelector('.queue-progress-fill');
            const progressInterval = setInterval(() => {
                if (progress < 85) {
                    progress += Math.floor(Math.random() * 15) + 5;
                    if (progress > 85) progress = 85;
                    progressFill.style.width = progress + '%';
                }
            }, 150);

            // POST document metadata to API
            const documentData = {
                fileName: file.name,
                fileSize: sizeStr,
                fileUrl: `uploads/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
            };

            fetch('/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(documentData)
            })
            .then(res => {
                clearInterval(progressInterval);
                if (!res.ok) {
                    throw new Error('Upload endpoint error');
                }
                return res.json();
            })
            .then(data => {
                progressFill.style.width = '100%';
                progressFill.classList.add('is-complete');

                const statusBadge = li.querySelector('.queue-status');
                statusBadge.className = 'queue-status status-ready';
                statusBadge.textContent = 'Ready to Print';
                li.setAttribute('data-status', 'ready');

                const removeBtn = li.querySelector('.queue-remove-btn');
                removeBtn.addEventListener('click', () => {
                    li.remove();
                    updateQueueCount();
                });

                updateQueueCount();
                renderDocumentLibrary();
                refreshRecentActivitiesTable();
            })
            .catch(err => {
                clearInterval(progressInterval);
                
                // Fallback upload mock for offline local testing
                console.warn('API upload failed, running local upload fallback...', err);
                
                progressFill.style.width = '100%';
                progressFill.classList.add('is-complete');

                const statusBadge = li.querySelector('.queue-status');
                statusBadge.className = 'queue-status status-ready';
                statusBadge.textContent = 'Ready to Print';
                li.setAttribute('data-status', 'ready');

                const removeBtn = li.querySelector('.queue-remove-btn');
                removeBtn.addEventListener('click', () => {
                    li.remove();
                    updateQueueCount();
                });

                updateQueueCount();

                // Save mock document locally
                const localDoc = {
                    id: 'local_' + Date.now(),
                    fileName: file.name,
                    fileSize: sizeStr,
                    fileUrl: documentData.fileUrl,
                    status: 'Ready to Print',
                    uploadedAt: new Date().toISOString()
                };
                saveMockDocumentLocally(localDoc);
                renderDocumentLibrary();
                refreshRecentActivitiesTable();
            });
        };

        const saveMockDocumentLocally = (doc) => {
            const localDocs = JSON.parse(localStorage.getItem('uploadedDocuments') || '[]');
            localDocs.unshift(doc);
            localStorage.setItem('uploadedDocuments', JSON.stringify(localDocs));
        };

        const updateQueueCount = () => {
            const countLabel = document.querySelector('.queue-count');
            if (countLabel) {
                const count = uploadQueue.querySelectorAll('.queue-item').length;
                countLabel.textContent = `${count} file${count !== 1 ? 's' : ''}`;
            }
        };

        // ── Document Library Rendering & Deletion Logic (SCRUM-35) ──
        const getFileIconClass = (filename) => {
            const ext = getFileExt(filename).replace('.', '');
            if (['pdf', 'docx', 'pptx'].includes(ext)) return ext;
            return 'pdf';
        };

        const getFileIconSvg = (ext) => {
            if (ext === 'docx') {
                return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM9 13h6v2H9v-2zm0 4h4v2H9v-2z"/></svg>';
            } else if (ext === 'pptx') {
                return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 11h8v2H8v-2zm0 4h6v2H8v-2z"/></svg>';
            }
            return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2 5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/></svg>';
        };

        const deleteDocument = (docId) => {
            if (!confirm('Are you sure you want to delete this document?')) return;

            fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => {
                if (!res.ok) throw new Error('Delete request failed');
                return res.json();
            })
            .then(() => {
                renderDocumentLibrary();
                refreshRecentActivitiesTable();
            })
            .catch(err => {
                console.warn('API delete failed/offline, performing local removal...', err);
                const localDocs = JSON.parse(localStorage.getItem('uploadedDocuments') || '[]');
                const filteredDocs = localDocs.filter(d => String(d.id) !== String(docId));
                localStorage.setItem('uploadedDocuments', JSON.stringify(filteredDocs));
                renderDocumentLibrary();
                refreshRecentActivitiesTable();
            });
        };

        const renderDocumentLibrary = () => {
            const grid = document.getElementById('libraryGrid');
            const countText = document.getElementById('libraryCountText');
            if (!grid || !countText) return;

            fetch('/api/documents', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(docs => {
                const localDocs = JSON.parse(localStorage.getItem('uploadedDocuments') || '[]');
                
                const docMap = new Map();
                localDocs.forEach(d => docMap.set(d.fileName + '_' + d.fileSize, d));
                docs.forEach(d => docMap.set(d.fileName + '_' + d.fileSize, d));
                
                const mergedDocs = Array.from(docMap.values()).sort((a, b) => {
                    return new Date(b.uploadedAt) - new Date(a.uploadedAt);
                });

                if (mergedDocs.length === 0) {
                    grid.innerHTML = `
                        <div class="library-empty-state" id="libraryEmptyState">
                            <div class="empty-state-icon">📂</div>
                            <p class="empty-state-title">No documents saved yet</p>
                            <p class="empty-state-subtitle">Files uploaded through the drop zone will appear here.</p>
                        </div>
                    `;
                    countText.textContent = '0 files';
                    return;
                }

                countText.textContent = `${mergedDocs.length} file${mergedDocs.length !== 1 ? 's' : ''}`;
                grid.innerHTML = '';

                mergedDocs.forEach(doc => {
                    const ext = getFileIconClass(doc.fileName);
                    const iconSvg = getFileIconSvg(ext);
                    const formattedDate = new Date(doc.uploadedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });

                    const card = document.createElement('div');
                    card.className = 'document-card';
                    card.innerHTML = `
                        <div class="document-card-top">
                            <div class="document-icon ${ext}">
                                ${iconSvg}
                            </div>
                            <div class="document-details">
                                <h4 class="document-name" title="${doc.fileName}">${doc.fileName}</h4>
                                <div class="document-meta">
                                    <span>${doc.fileSize}</span>
                                    <span>•</span>
                                    <span>${formattedDate}</span>
                                </div>
                            </div>
                        </div>
                        <div class="document-card-bottom">
                            <button type="button" class="print-file-btn">🖨️ Print Now</button>
                            <button type="button" class="delete-file-btn" data-id="${doc.id}" aria-label="Delete document">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                            </button>
                        </div>
                    `;

                    card.querySelector('.delete-file-btn').addEventListener('click', () => {
                        deleteDocument(doc.id);
                    });

                    card.querySelector('.print-file-btn').addEventListener('click', () => {
                        openPrintOrderModal(doc.id);
                    });

                    grid.appendChild(card);
                });
            })
            .catch(err => {
                console.error('Error rendering document library:', err);
            });
        };

        const refreshRecentActivitiesTable = () => {
            fetch('/api/print-orders', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(orders => {
                const localOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
                
                const orderMap = new Map();
                localOrders.forEach(o => orderMap.set(o.id || o.createdAt, o));
                orders.forEach(o => orderMap.set(o.id || o.createdAt, o));
                
                const mergedOrders = Array.from(orderMap.values()).sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });

                const dashboardTbody = document.querySelector('#dashboard-view .table-wrapper table tbody');
                const historyTbody = document.querySelector('#history-view .table-wrapper table tbody');

                const populateTable = (tbody, items) => {
                    if (!tbody) return;
                    tbody.innerHTML = '';
                    items.forEach(order => {
                        const date = new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });

                        const copiesStr = order.copies > 1 ? ` (${order.copies} copies)` : '';
                        const costDisplay = order.paymentMethod === 'Quota' ? 'Quota' : `৳ ${order.estimatedCost}`;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>
                                <div>
                                    <strong style="display: block;">${order.documentName}</strong>
                                    <small style="color: var(--muted); font-size: 0.76rem;">${order.colorMode} • ${order.duplex} • ${order.paperSize}${copiesStr}</small>
                                </div>
                            </td>
                            <td>${date}</td>
                            <td>${order.pages * order.copies}</td>
                            <td>${costDisplay}</td>
                            <td><span class="status-badge ${order.status.toLowerCase() === 'completed' ? 'completed' : 'processing'}">${order.status || 'Pending'}</span></td>
                        `;
                        tbody.appendChild(tr);
                    });
                };

                if (mergedOrders.length > 0) {
                    populateTable(dashboardTbody, mergedOrders);
                    populateTable(historyTbody, mergedOrders);
                } else {
                    const emptyRow = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 24px;">No print orders placed yet. Upload files and click Print Now to start!</td></tr>`;
                    if (dashboardTbody) dashboardTbody.innerHTML = emptyRow;
                    if (historyTbody) historyTbody.innerHTML = emptyRow;
                }
            })
            .catch(err => {
                console.warn('API error loading print orders queue, using local fallback...', err);
                const localOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
                const dashboardTbody = document.querySelector('#dashboard-view .table-wrapper table tbody');
                const historyTbody = document.querySelector('#history-view .table-wrapper table tbody');

                const populateTable = (tbody, items) => {
                    if (!tbody) return;
                    tbody.innerHTML = '';
                    items.forEach(order => {
                        const date = new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });
                        const copiesStr = order.copies > 1 ? ` (${order.copies} copies)` : '';
                        const costDisplay = order.paymentMethod === 'Quota' ? 'Quota' : `৳ ${order.estimatedCost}`;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>
                                <div>
                                    <strong style="display: block;">${order.documentName}</strong>
                                    <small style="color: var(--muted); font-size: 0.76rem;">${order.colorMode} • ${order.duplex} • ${order.paperSize}${copiesStr}</small>
                                </div>
                            </td>
                            <td>${date}</td>
                            <td>${order.pages * order.copies}</td>
                            <td>${costDisplay}</td>
                            <td><span class="status-badge processing">${order.status || 'Pending'}</span></td>
                        `;
                        tbody.appendChild(tr);
                    });
                };

                if (localOrders.length > 0) {
                    populateTable(dashboardTbody, localOrders);
                    populateTable(historyTbody, localOrders);
                } else {
                    const emptyRow = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 24px;">No print orders placed yet. Upload files and click Print Now to start!</td></tr>`;
                    if (dashboardTbody) dashboardTbody.innerHTML = emptyRow;
                    if (historyTbody) historyTbody.innerHTML = emptyRow;
                }
            });
        };

        // Wire existing delete buttons
        uploadQueue.querySelectorAll('.queue-item').forEach(item => {
            item.querySelector('.queue-remove-btn')?.addEventListener('click', () => {
                item.remove();
                updateQueueCount();
            });
        });

        // ── Print Order Modal Logic (SCRUM-44) ──
        const printOrderModal = document.getElementById('printOrderModal');
        const printOrderForm = document.getElementById('printOrderForm');
        const printDocSelect = document.getElementById('printDocSelect');
        const printCopies = document.getElementById('printCopies');
        const printPaperSize = document.getElementById('printPaperSize');
        const printOrientation = document.getElementById('printOrientation');
        const printPageRange = document.getElementById('printPageRange');
        const printTerminal = document.getElementById('printTerminal');
        const colorModeBW = document.getElementById('colorModeBW');
        const colorModeColor = document.getElementById('colorModeColor');
        const duplexSingle = document.getElementById('duplexSingle');
        const duplexDouble = document.getElementById('duplexDouble');

        const summaryDocPages = document.getElementById('summaryDocPages');
        const summaryTotalPages = document.getElementById('summaryTotalPages');
        const summaryUnitCost = document.getElementById('summaryUnitCost');
        const summaryTotalCost = document.getElementById('summaryTotalCost');

        const paymentMethodQuota = document.getElementById('paymentMethodQuota');
        const paymentMethodWallet = document.getElementById('paymentMethodWallet');
        const quotaLimitLabel = document.getElementById('quotaLimitLabel');
        const walletBalanceLabel = document.getElementById('walletBalanceLabel');
        const paymentOptionQuotaCard = document.getElementById('paymentOptionQuotaCard');
        const paymentOptionWalletCard = document.getElementById('paymentOptionWalletCard');

        const printValidationWarning = document.getElementById('printValidationWarning');
        const submitOrderBtn = document.getElementById('submitOrderBtn');
        const closePrintModalBtn = document.getElementById('closePrintModalBtn');
        const cancelPrintBtn = document.getElementById('cancelPrintBtn');

        let allDocumentsList = [];
        let selectedDocObj = null;

        // Fetch documents to populate select list
        const loadDocDropdown = (selectedDocId = null) => {
            fetch('/api/documents', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(docs => {
                const localDocs = JSON.parse(localStorage.getItem('uploadedDocuments') || '[]');
                const docMap = new Map();
                localDocs.forEach(d => docMap.set(d.id, d));
                docs.forEach(d => docMap.set(d.id, d));
                allDocumentsList = Array.from(docMap.values());

                if (printDocSelect) {
                    printDocSelect.innerHTML = '';
                    if (allDocumentsList.length === 0) {
                        printDocSelect.innerHTML = '<option value="">-- No documents uploaded yet 📂 --</option>';
                        selectedDocObj = null;
                        updateCostEstimate();
                        return;
                    }
                    
                    allDocumentsList.forEach(doc => {
                        const opt = document.createElement('option');
                        opt.value = doc.id;
                        opt.textContent = `${doc.fileName} (${doc.pages || 10} pages)`;
                        if (String(doc.id) === String(selectedDocId)) {
                            opt.selected = true;
                        }
                        printDocSelect.appendChild(opt);
                    });

                    const selectedId = printDocSelect.value;
                    selectedDocObj = allDocumentsList.find(d => String(d.id) === String(selectedId));
                    updateCostEstimate();
                }
            })
            .catch(err => {
                console.warn('API error loading documents dropdown, using local fallback...', err);
                const localDocs = JSON.parse(localStorage.getItem('uploadedDocuments') || '[]');
                allDocumentsList = localDocs;
                if (printDocSelect) {
                    printDocSelect.innerHTML = '';
                    if (allDocumentsList.length === 0) {
                        printDocSelect.innerHTML = '<option value="">-- No documents uploaded yet 📂 --</option>';
                        selectedDocObj = null;
                        updateCostEstimate();
                        return;
                    }
                    allDocumentsList.forEach(doc => {
                        const opt = document.createElement('option');
                        opt.value = doc.id;
                        opt.textContent = `${doc.fileName} (${doc.pages || 10} pages)`;
                        if (String(doc.id) === String(selectedDocId)) {
                            opt.selected = true;
                        }
                        printDocSelect.appendChild(opt);
                    });
                    const selectedId = printDocSelect.value;
                    selectedDocObj = allDocumentsList.find(d => String(d.id) === String(selectedId));
                    updateCostEstimate();
                }
            });
        };

        // Open modal helpers
        const openPrintOrderModal = (documentId = null) => {
            loadDocDropdown(documentId);
            
            // Load and apply default print settings (SCRUM-48 / SCRUM-49)
            const savedSettings = JSON.parse(localStorage.getItem('printSettings') || 'null');
            if (savedSettings) {
                const { defaultPref, defaultTerminal } = savedSettings;
                if (defaultPref) {
                    if (defaultPref === 'duplex_bw') {
                        colorModeBW.checked = true;
                        duplexDouble.checked = true;
                    } else if (defaultPref === 'simplex_bw') {
                        colorModeBW.checked = true;
                        duplexSingle.checked = true;
                    } else if (defaultPref === 'duplex_color') {
                        colorModeColor.checked = true;
                        duplexDouble.checked = true;
                    } else if (defaultPref === 'simplex_color') {
                        colorModeColor.checked = true;
                        duplexSingle.checked = true;
                    }
                }
                if (defaultTerminal && printTerminal) {
                    printTerminal.value = defaultTerminal;
                }
            }

            // Sync payment radio button active card highlights
            if (paymentMethodQuota.checked) {
                paymentOptionQuotaCard?.classList.add('active');
                paymentOptionWalletCard?.classList.remove('active');
            } else {
                paymentOptionQuotaCard?.classList.remove('active');
                paymentOptionWalletCard?.classList.add('active');
            }

            printOrderModal?.classList.add('open');
        };

        const closePrintModal = () => {
            printOrderModal?.classList.remove('open');
        };

        closePrintModalBtn?.addEventListener('click', closePrintModal);
        cancelPrintBtn?.addEventListener('click', closePrintModal);
        printOrderModal?.addEventListener('click', (e) => {
            if (e.target === printOrderModal) closePrintModal();
        });

        // Trigger on selecting another document in dropdown
        printDocSelect?.addEventListener('change', () => {
            const selectedId = printDocSelect.value;
            selectedDocObj = allDocumentsList.find(d => String(d.id) === String(selectedId));
            updateCostEstimate();
        });

        // Update summary and cost estimation
        const updateCostEstimate = () => {
            if (!selectedDocObj) {
                summaryDocPages.textContent = '-- pages';
                summaryTotalPages.textContent = '-- pages';
                summaryTotalCost.textContent = '৳ 0.00';
                submitOrderBtn.disabled = true;
                return;
            }

            const docPages = selectedDocObj.pages || 10;
            const copies = parseInt(printCopies.value) || 1;
            const isColor = colorModeColor.checked;
            const isDuplex = duplexDouble.checked;

            // Page calculation factoring range
            let printPages = docPages;
            const rangeVal = printPageRange.value.trim().toLowerCase();
            if (rangeVal && rangeVal !== 'all') {
                const match = rangeVal.match(/^(\d+)-(\d+)$/);
                if (match) {
                    const start = parseInt(match[1]);
                    const end = parseInt(match[2]);
                    if (start > 0 && end >= start && end <= docPages) {
                        printPages = end - start + 1;
                    }
                } else if (/^\d+$/.test(rangeVal)) {
                    const single = parseInt(rangeVal);
                    if (single > 0 && single <= docPages) {
                        printPages = 1;
                    }
                }
            }

            const totalPagesToPrint = printPages * copies;

            // Unit pricing
            let unitCost = 2.0; // B&W Simplex
            if (isColor) {
                unitCost = isDuplex ? 4.0 : 5.0;
            } else {
                unitCost = isDuplex ? 1.5 : 2.0;
            }

            // Paper size pricing adjustment (SCRUM-47)
            if (printPaperSize && printPaperSize.value === 'Legal') {
                unitCost += 1.0;
            }

            const estTotalCost = totalPagesToPrint * unitCost;

            // Update DOM fields
            summaryDocPages.textContent = `${docPages} page${docPages !== 1 ? 's' : ''}`;
            summaryTotalPages.textContent = `${totalPagesToPrint} page${totalPagesToPrint !== 1 ? 's' : ''}`;
            summaryUnitCost.textContent = `৳ ${unitCost.toFixed(2)} / page`;
            summaryTotalCost.textContent = `৳ ${estTotalCost.toFixed(2)}`;

            // ── Update Print Preview Visualizer (SCRUM-45) ──
            const previewPaper = document.getElementById('previewPaper');
            const previewPaperBack = document.getElementById('previewPaperBack');
            const previewPageIndicator = document.getElementById('previewPageIndicator');
            const previewColorIndicator = document.getElementById('previewColorIndicator');
            const previewCopiesBadge = document.getElementById('previewCopiesBadge');

            if (previewPaper) {
                // Determine base size of paper according to paper size (SCRUM-47)
                let baseWidth = 80;
                let baseHeight = 110;
                if (printPaperSize && printPaperSize.value === 'Letter') {
                    baseWidth = 84;
                    baseHeight = 106;
                } else if (printPaperSize && printPaperSize.value === 'Legal') {
                    baseWidth = 76;
                    baseHeight = 120;
                }

                // Orientation rotation
                if (printOrientation && printOrientation.value === 'Landscape') {
                    previewPaper.style.width = `${baseHeight}px`;
                    previewPaper.style.height = `${baseWidth}px`;
                } else {
                    previewPaper.style.width = `${baseWidth}px`;
                    previewPaper.style.height = `${baseHeight}px`;
                }

                // Duplex backing sheet toggle
                if (previewPaperBack) {
                    previewPaperBack.style.display = isDuplex ? 'block' : 'none';
                }

                // Copies badge text
                if (previewCopiesBadge) {
                    previewCopiesBadge.textContent = `${copies} cop${copies > 1 ? 'ies' : 'y'}`;
                }

                // Page indicators
                if (previewPageIndicator) {
                    previewPageIndicator.textContent = `1/${printPages}`;
                }

                // Color lines & indicator toggle
                const headerLine = previewPaper.querySelector('.preview-line.header');
                const detailLines = previewPaper.querySelectorAll('.preview-line:not(.header)');
                
                if (isColor) {
                    if (previewColorIndicator) {
                        previewColorIndicator.style.background = 'linear-gradient(135deg, #3b82f6, #ec4899)';
                    }
                    if (headerLine) headerLine.style.background = '#2563eb';
                    detailLines.forEach((line, idx) => {
                        line.style.background = idx % 2 === 0 ? '#60a5fa' : '#f472b6';
                    });
                } else {
                    if (previewColorIndicator) {
                        previewColorIndicator.style.background = '#94a3b8';
                    }
                    if (headerLine) headerLine.style.background = '#64748b';
                    detailLines.forEach(line => {
                        line.style.background = '#cbd5e1';
                    });
                }
            }

            // Sync user data for budget validations
            const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
            if (student) {
                const walletBal = student.walletBalance || 0;
                const quotaLeft = Math.max((student.totalPages || 100) - (student.usedPages || 50), 0);

                quotaLimitLabel.textContent = `Left: ${quotaLeft} pages`;
                walletBalanceLabel.textContent = `Bal: ৳ ${walletBal.toFixed(2)}`;

                let validationPass = true;
                if (paymentMethodQuota.checked) {
                    if (quotaLeft < totalPagesToPrint) {
                        validationPass = false;
                        printValidationWarning.textContent = `⚠️ Insufficient print quota. You need ${totalPagesToPrint} free pages, but only have ${quotaLeft} left.`;
                        printValidationWarning.style.display = 'block';
                    } else {
                        printValidationWarning.style.display = 'none';
                    }
                } else {
                    if (walletBal < estTotalCost) {
                        validationPass = false;
                        printValidationWarning.textContent = `⚠️ Insufficient wallet balance. You need ৳ ${estTotalCost.toFixed(2)}, but only have ৳ ${walletBal.toFixed(2)}.`;
                        printValidationWarning.style.display = 'block';
                    } else {
                        printValidationWarning.style.display = 'none';
                    }
                }

                submitOrderBtn.disabled = !validationPass;
            }
        };

        // Inputs triggering recalculation
        [printCopies, printPageRange].forEach(input => {
            input?.addEventListener('input', updateCostEstimate);
        });

        [printPaperSize, printOrientation, printTerminal].forEach(select => {
            select?.addEventListener('change', updateCostEstimate);
        });

        [colorModeBW, colorModeColor, duplexSingle, duplexDouble, paymentMethodQuota, paymentMethodWallet].forEach(radio => {
            radio?.addEventListener('change', (e) => {
                // Style payment selection cards active states
                if (paymentMethodQuota.checked) {
                    paymentOptionQuotaCard?.classList.add('active');
                    paymentOptionWalletCard?.classList.remove('active');
                } else {
                    paymentOptionQuotaCard?.classList.remove('active');
                    paymentOptionWalletCard?.classList.add('active');
                }
                updateCostEstimate();
            });
        });

        // Submit Print Order handler
        printOrderForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!selectedDocObj) return;

            const docPages = selectedDocObj.pages || 10;
            const copies = parseInt(printCopies.value) || 1;
            const isColor = colorModeColor.checked;
            const isDuplex = duplexDouble.checked;
            
            let printPages = docPages;
            const rangeVal = printPageRange.value.trim().toLowerCase();
            if (rangeVal && rangeVal !== 'all') {
                const match = rangeVal.match(/^(\d+)-(\d+)$/);
                if (match) {
                    const start = parseInt(match[1]);
                    const end = parseInt(match[2]);
                    if (start > 0 && end >= start && end <= docPages) {
                        printPages = end - start + 1;
                    }
                } else if (/^\d+$/.test(rangeVal)) {
                    const single = parseInt(rangeVal);
                    if (single > 0 && single <= docPages) {
                        printPages = 1;
                    }
                }
            }

            const totalPagesToPrint = printPages * copies;
            let unitCost = isColor ? (isDuplex ? 4.0 : 5.0) : (isDuplex ? 1.5 : 2.0);
            if (printPaperSize && printPaperSize.value === 'Legal') {
                unitCost += 1.0;
            }
            const estTotalCost = totalPagesToPrint * unitCost;

            const orderData = {
                documentId: selectedDocObj.id,
                documentName: selectedDocObj.fileName,
                copies: copies,
                colorMode: isColor ? 'Color' : 'Black & White',
                duplex: isDuplex ? 'Double-Sided' : 'Single-Sided',
                orientation: printOrientation.value,
                paperSize: printPaperSize.value,
                pageRange: printPageRange.value,
                printerTerminal: printTerminal.value,
                estimatedCost: estTotalCost,
                pages: printPages,
                paymentMethod: paymentMethodQuota.checked ? 'Quota' : 'Wallet'
            };

            fetch('/api/print-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(orderData)
            })
            .then(res => {
                if (!res.ok) return res.json().then(j => { throw new Error(j.error || 'Server rejected order') });
                return res.json();
            })
            .then(data => {
                // Sync profile data and update displays
                localStorage.setItem('currentStudent', JSON.stringify(data.student));
                
                // Sync globally in profile.js
                if (window.syncProfileDisplay) {
                    window.syncProfileDisplay(data.student);
                } else if (typeof renderStudentData === 'function') {
                    renderStudentData(data.student);
                }

                alert('Print job submitted successfully! Sent to terminal queue.');
                closePrintModal();
                refreshRecentActivitiesTable();
                refreshTransactionsTable();
                renderDocumentLibrary(); // Refresh doc library statuses
            })
            .catch(err => {
                console.warn('API print order failed, running local fallback...', err);
                
                const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
                if (!student) return;

                // Local offline deduction
                if (paymentMethodQuota.checked) {
                    student.usedPages = (student.usedPages || 50) + totalPagesToPrint;
                } else {
                    student.walletBalance = (student.walletBalance || 1250) - estTotalCost;
                }

                localStorage.setItem('currentStudent', JSON.stringify(student));
                if (typeof renderStudentData === 'function') {
                    renderStudentData(student);
                }

                const localOrder = {
                    id: 'ord_' + Date.now(),
                    userId: student.id,
                    documentName: orderData.documentName,
                    copies: orderData.copies,
                    colorMode: orderData.colorMode,
                    duplex: orderData.duplex,
                    orientation: orderData.orientation,
                    paperSize: orderData.paperSize,
                    pageRange: orderData.pageRange,
                    printerTerminal: orderData.printerTerminal,
                    estimatedCost: orderData.estimatedCost,
                    pages: orderData.pages,
                    paymentMethod: orderData.paymentMethod,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                };

                const localOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
                localOrders.unshift(localOrder);
                localStorage.setItem('printOrders', JSON.stringify(localOrders));

                const localTxn = {
                    id: 'txn_' + Date.now(),
                    referenceId: 'TXN-' + Math.floor(10000 + Math.random() * 90000),
                    type: orderData.paymentMethod === 'Quota' ? 'Print Quota Debit' : 'Print Wallet Debit',
                    amount: orderData.paymentMethod === 'Quota' ? 0 : estTotalCost,
                    status: 'Success',
                    createdAt: new Date().toISOString()
                };

                const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
                localTxns.unshift(localTxn);
                localStorage.setItem('transactions', JSON.stringify(localTxns));

                alert('Print order submitted successfully (Offline mode).');
                closePrintModal();
                refreshRecentActivitiesTable();
                refreshTransactionsTable();
                renderDocumentLibrary();
            });
        });

        // Topbar "＋ Create New Print" listener
        const topbarCreateBtn = document.querySelector('.topbar-actions .create-btn');
        topbarCreateBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            openPrintOrderModal();
        });

        // Sidebar "New Print Request" navigation adjustment or button
        const submitPrintBtn = document.querySelector('.submit-print-btn');
        submitPrintBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            openPrintOrderModal();
        });

        // ── Transactions Table Rendering ──
        const refreshTransactionsTable = () => {
            const tableBody = document.querySelector('#billing-view .table-wrapper table tbody');
            if (!tableBody) return;

            fetch('/api/transactions', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(txns => {
                const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
                const txnMap = new Map();
                localTxns.forEach(t => txnMap.set(t.referenceId, t));
                txns.forEach(t => txnMap.set(t.referenceId, t));

                const mergedTxns = Array.from(txnMap.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                tableBody.innerHTML = '';
                if (mergedTxns.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 20px;">No transactions recorded.</td></tr>`;
                    return;
                }

                mergedTxns.forEach(txn => {
                    const dateStr = new Date(txn.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });

                    const isCredit = txn.type.toLowerCase().includes('credit') || txn.type.toLowerCase().includes('top-up');
                    const amtStyle = isCredit ? 'color: var(--success); font-weight: 600;' : 'color: var(--danger); font-weight: 600;';
                    const amtSign = isCredit ? '+' : '-';
                    const amtLabel = txn.amount === 0 ? 'Quota' : `${amtSign} ৳ ${txn.amount}`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${txn.referenceId}</td>
                        <td>${dateStr}</td>
                        <td>${txn.type}</td>
                        <td style="${amtStyle}">${amtLabel}</td>
                        <td><span class="status-badge completed">${txn.status}</span></td>
                    `;
                    tableBody.appendChild(tr);
                });
            })
            .catch(err => {
                console.warn('API error loading transactions, using local fallback...', err);
                const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
                tableBody.innerHTML = '';
                if (localTxns.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 20px;">No transactions recorded.</td></tr>`;
                    return;
                }
                localTxns.forEach(txn => {
                    const dateStr = new Date(txn.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });
                    const isCredit = txn.type.includes('Credit') || txn.type.includes('Top-up');
                    const amtStyle = isCredit ? 'color: var(--success); font-weight: 600;' : 'color: var(--danger); font-weight: 600;';
                    const amtSign = isCredit ? '+' : '-';
                    const amtLabel = txn.amount === 0 ? 'Quota' : `${amtSign} ৳ ${txn.amount}`;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${txn.referenceId}</td>
                        <td>${dateStr}</td>
                        <td>${txn.type}</td>
                        <td style="${amtStyle}">${amtLabel}</td>
                        <td><span class="status-badge completed">${txn.status}</span></td>
                    `;
                    tableBody.appendChild(tr);
                });
            });
        };

        // ── Top-up Wallet Logic ──
        const topupWalletBtn = document.getElementById('topupWalletBtn');
        topupWalletBtn?.addEventListener('click', () => {
            const amtStr = prompt('Enter the amount in Taka to top up (e.g. 500):');
            if (!amtStr) return;
            const amt = parseFloat(amtStr);
            if (isNaN(amt) || amt <= 0) {
                alert('Please enter a valid positive number.');
                return;
            }

            fetch('/api/wallet/topup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount: amt })
            })
            .then(res => {
                if (!res.ok) throw new Error('Top-up server error');
                return res.json();
            })
            .then(data => {
                localStorage.setItem('currentStudent', JSON.stringify(data.student));
                if (typeof renderStudentData === 'function') {
                    renderStudentData(data.student);
                }
                alert(`Successfully topped up ৳ ${amt}!`);
                refreshTransactionsTable();
            })
            .catch(err => {
                console.warn('API top-up failed, running local fallback...', err);
                const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
                if (student) {
                    student.walletBalance = (student.walletBalance || 1250) + amt;
                    localStorage.setItem('currentStudent', JSON.stringify(student));
                    if (typeof renderStudentData === 'function') {
                        renderStudentData(student);
                    }

                    const localTxn = {
                        id: 'txn_' + Date.now(),
                        referenceId: 'TXN-' + Math.floor(10000 + Math.random() * 90000),
                        type: 'Wallet Top-up Credit',
                        amount: amt,
                        status: 'Success',
                        createdAt: new Date().toISOString()
                    };
                    const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
                    localTxns.unshift(localTxn);
                    localStorage.setItem('transactions', JSON.stringify(localTxns));

                    alert(`Successfully topped up ৳ ${amt} (Offline fallback).`);
                    refreshTransactionsTable();
                }
            });
        });

        // ── Settings Preferences Form Logic (SCRUM-48 / SCRUM-49) ──
        const settingsForm = document.getElementById('settingsForm');
        const defaultPrintPref = document.getElementById('defaultPrintPref');
        const defaultPrinterTerminal = document.getElementById('defaultPrinterTerminal');
        const checkNotify = document.getElementById('checkNotify');

        // Load settings to populate settings fields on page load
        const loadSettingsFields = () => {
            const savedSettings = JSON.parse(localStorage.getItem('printSettings') || 'null');
            if (savedSettings) {
                const { defaultPref, defaultTerminal, notify } = savedSettings;
                if (defaultPrintPref && defaultPref) {
                    defaultPrintPref.value = defaultPref;
                }
                if (defaultPrinterTerminal && defaultTerminal) {
                    defaultPrinterTerminal.value = defaultTerminal;
                }
                if (checkNotify) {
                    checkNotify.checked = notify !== false;
                }
            }
        };

        settingsForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const defaultPref = defaultPrintPref?.value || 'duplex_bw';
            const defaultTerminal = defaultPrinterTerminal?.value || 'Central Library - Terminal 1';
            const notify = checkNotify ? checkNotify.checked : true;

            const printSettings = { defaultPref, defaultTerminal, notify };
            localStorage.setItem('printSettings', JSON.stringify(printSettings));
            alert('Default printing preferences saved successfully!');
        });

        // Initialize table & library rendering, and load settings
        loadSettingsFields();
        renderDocumentLibrary();
        refreshRecentActivitiesTable();
        refreshTransactionsTable();
    }
});
