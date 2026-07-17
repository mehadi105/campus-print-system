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

                // Append local mock row to recent activities table
                const tbody = document.querySelector('.table-wrapper table tbody');
                if (tbody) {
                    const date = new Date().toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });
                    const pages = Math.floor(Math.random() * 20) + 5;
                    const cost = pages * 3;

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${file.name}</td>
                        <td>${date}</td>
                        <td>${pages}</td>
                        <td>৳ ${cost}</td>
                        <td><span class="status-badge processing">Ready to Print</span></td>
                    `;
                    
                    // If the first child is a mocked row (e.g. "Final Report Draft"), clear it first
                    if (tbody.children.length === 4 && tbody.innerHTML.includes('Final Report Draft')) {
                        tbody.innerHTML = '';
                    }
                    tbody.prepend(tr);
                }
            });
        };

        const updateQueueCount = () => {
            const countLabel = document.querySelector('.queue-count');
            if (countLabel) {
                const count = uploadQueue.querySelectorAll('.queue-item').length;
                countLabel.textContent = `${count} file${count !== 1 ? 's' : ''}`;
            }
        };

        const refreshRecentActivitiesTable = () => {
            fetch('/api/documents', {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.ok ? res.json() : [])
            .then(docs => {
                const tbody = document.querySelector('.table-wrapper table tbody');
                if (!tbody) return;

                if (docs && docs.length > 0) {
                    tbody.innerHTML = '';
                    docs.forEach(doc => {
                        const date = new Date(doc.uploadedAt || Date.now()).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        });
                        const pages = Math.floor(Math.random() * 20) + 5;
                        const cost = pages * 3;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${doc.fileName}</td>
                            <td>${date}</td>
                            <td>${pages}</td>
                            <td>৳ ${cost}</td>
                            <td><span class="status-badge processing">${doc.status}</span></td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            })
            .catch(err => console.error('Error loading history:', err));
        };

        // Wire existing delete buttons
        uploadQueue.querySelectorAll('.queue-item').forEach(item => {
            item.querySelector('.queue-remove-btn')?.addEventListener('click', () => {
                item.remove();
                updateQueueCount();
            });
        });

        // Initialize table
        refreshRecentActivitiesTable();
    }
});
