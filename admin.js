// ── Administrator Dashboard controller (SCRUM-58) ──
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const currentAdmin = JSON.parse(localStorage.getItem('currentStudent') || 'null');

    // Secure auth check
    if (!token || !currentAdmin || currentAdmin.role !== 'Admin') {
        alert('Access denied. Administrator privileges required.');
        window.location.href = 'index.html';
        return;
    }

    // Set topbar dates and admin details
    const topbarDate = document.getElementById('topbar-date');
    if (topbarDate) {
        topbarDate.textContent = new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }

    const adminNameDisplay = document.getElementById('admin-name-display');
    if (adminNameDisplay && currentAdmin.fullName) {
        adminNameDisplay.textContent = currentAdmin.fullName;
    }

    // ── Tab Navigation Switching ──
    const navLinks = document.querySelectorAll('.sidebar .nav-links .nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTabId = link.getAttribute('href').substring(1);

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            tabContents.forEach(tab => {
                if (tab.id === targetTabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });

            // Reload relevant views
            if (targetTabId === 'queue-view') refreshAdminQueue();
            if (targetTabId === 'printers-view') refreshAdminPrinters();
            if (targetTabId === 'students-view') refreshAdminStudents();
        });
    });

    // ── Admin Logout Logic ──
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    adminLogoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('currentStudent');
        window.location.href = 'index.html';
    });

    // ── Global Caches ──
    let adminCachedOrders = [];
    let adminCachedStudents = [];
    let adminCachedPrinters = [];

    // ── Load Dashboard Stats Metrics ──
    const refreshAdminStats = () => {
        fetch('/api/admin/stats', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : Promise.reject('Failed stats fetch'))
        .then(stats => {
            updateStatsDisplays(stats);
        })
        .catch(err => {
            console.warn('API Stats failed, computing metrics offline...', err);
            
            // Offline fallbacks stats calculations
            const localOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
            const localStudents = JSON.parse(localStorage.getItem('registeredStudent') ? [JSON.parse(localStorage.getItem('registeredStudent'))] : '[]');
            
            const activeCount = localOrders.filter(o => ['pending', 'processing', 'submitted'].includes((o.status || '').toLowerCase())).length;
            const completedCount = localOrders.filter(o => (o.status || '').toLowerCase() === 'completed').length;
            const revenueSum = localOrders
                .filter(o => (o.status || '').toLowerCase() === 'completed' && o.paymentMethod === 'Wallet')
                .reduce((sum, o) => sum + (o.estimatedCost || 0), 0);

            updateStatsDisplays({
                activeJobs: activeCount,
                completedJobs: completedCount,
                totalRevenue: revenueSum,
                studentCount: localStudents.length || 1
            });
        });
    };

    const updateStatsDisplays = (stats) => {
        const statActiveJobs = document.getElementById('statActiveJobs');
        const statCompletedJobs = document.getElementById('statCompletedJobs');
        const statRevenue = document.getElementById('statRevenue');
        const statStudents = document.getElementById('statStudents');

        if (statActiveJobs) statActiveJobs.textContent = stats.activeJobs;
        if (statCompletedJobs) statCompletedJobs.textContent = stats.completedJobs;
        if (statRevenue) statRevenue.textContent = `৳ ${stats.totalRevenue.toFixed(2)}`;
        if (statStudents) statStudents.textContent = stats.studentCount;
    };

    // ── Manage Print requests Queue (View 1) ──
    const refreshAdminQueue = () => {
        fetch('/api/admin/print-orders', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : [])
        .then(orders => {
            adminCachedOrders = orders;
            renderAdminQueueTable();
        })
        .catch(err => {
            console.warn('API print order fetching failed, using offline fallback...', err);
            adminCachedOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
            renderAdminQueueTable();
        });
    };

    const renderAdminQueueTable = () => {
        const tbody = document.querySelector('#adminQueueTable tbody');
        if (!tbody) return;

        const terminalFilter = document.getElementById('queueFilterTerminal')?.value || 'All';
        const statusFilter = document.getElementById('queueFilterStatus')?.value || 'All';

        const filtered = adminCachedOrders.filter(order => {
            // Terminal filter
            let terminalPass = terminalFilter === 'All' || order.printerTerminal === terminalFilter;
            
            // Status filter
            let statusPass = true;
            if (statusFilter !== 'All') {
                const status = (order.status || '').toLowerCase();
                if (statusFilter === 'Pending') {
                    statusPass = status === 'pending' || status === 'submitted';
                } else if (statusFilter === 'Processing') {
                    statusPass = status === 'processing';
                } else if (statusFilter === 'Completed') {
                    statusPass = status === 'completed' || status === 'ready for pickup';
                } else if (statusFilter === 'Cancelled') {
                    statusPass = status === 'cancelled' || status === 'rejected';
                }
            }

            return terminalPass && statusPass;
        });

        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">No print requests match criteria.</td></tr>`;
            return;
        }

        filtered.forEach(order => {
            const date = new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });

            const copiesStr = order.copies > 1 ? ` (${order.copies} copies)` : '';
            const paymentDisplay = order.paymentMethod === 'Quota' ? 'Quota' : `৳ ${order.estimatedCost}`;
            const status = order.status || 'Pending';
            
            let statusClass = 'processing';
            if (status.toLowerCase() === 'completed' || status.toLowerCase() === 'ready for pickup') statusClass = 'completed';
            if (status.toLowerCase() === 'cancelled' || status.toLowerCase() === 'rejected') statusClass = 'cancelled';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div>
                        <strong style="display: block;">${order.documentName}</strong>
                        <small style="color: var(--muted); font-size: 0.78rem;">Submitted by: ${order.fullName || 'Student'} (${order.rollId || 'N/A'})</small>
                    </div>
                </td>
                <td>${order.printerTerminal}</td>
                <td>${order.pages * order.copies} pgs <small style="display: block; color: var(--muted); font-size: 0.72rem;">${order.pages} pgs × ${order.copies} cop</small></td>
                <td>
                    <div>
                        <span style="font-weight: 700; color: var(--text);">${paymentDisplay}</span>
                        <small style="display: block; color: var(--muted); font-size: 0.72rem;">Ref: ${order.paymentMethod}</small>
                    </div>
                </td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td style="text-align: right;">
                    <div class="action-btn-group" id="actions-${order.id || order.createdAt}">
                        <!-- Action buttons injected below -->
                    </div>
                </td>
            `;

            const actionCell = tr.querySelector(`#actions-${CSS.escape(order.id || order.createdAt)}`);
            if (actionCell) {
                const normalizedStatus = status.toLowerCase();
                if (normalizedStatus === 'pending' || normalizedStatus === 'submitted') {
                    const btnProcess = document.createElement('button');
                    btnProcess.className = 'admin-btn btn-process';
                    btnProcess.textContent = 'Process';
                    btnProcess.addEventListener('click', () => updateJobStatus(order.id || order.createdAt, 'Processing'));

                    const btnReject = document.createElement('button');
                    btnReject.className = 'admin-btn btn-reject';
                    btnReject.textContent = 'Reject';
                    btnReject.addEventListener('click', () => updateJobStatus(order.id || order.createdAt, 'Rejected'));

                    actionCell.appendChild(btnProcess);
                    actionCell.appendChild(btnReject);
                } else if (normalizedStatus === 'processing') {
                    const btnComplete = document.createElement('button');
                    btnComplete.className = 'admin-btn btn-complete';
                    btnComplete.textContent = 'Complete';
                    btnComplete.addEventListener('click', () => updateJobStatus(order.id || order.createdAt, 'Completed'));

                    const btnReject = document.createElement('button');
                    btnReject.className = 'admin-btn btn-reject';
                    btnReject.textContent = 'Reject';
                    btnReject.addEventListener('click', () => updateJobStatus(order.id || order.createdAt, 'Rejected'));

                    actionCell.appendChild(btnComplete);
                    actionCell.appendChild(btnReject);
                } else {
                    actionCell.innerHTML = `<span style="font-size: 0.78rem; color: var(--muted); font-weight: 500;">No actions available</span>`;
                }
            }

            tbody.appendChild(tr);
        });
    };

    const updateJobStatus = (orderId, newStatus) => {
        fetch(`/api/admin/print-orders/${orderId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => {
            if (!res.ok) throw new Error('Failed status update API call');
            return res.json();
        })
        .then(() => {
            alert(`Print request successfully marked as ${newStatus}.`);
            refreshAdminQueue();
            refreshAdminStats();
        })
        .catch(err => {
            console.warn('API status update failed, running local offline update...', err);
            
            // Offline fallback updates
            const localOrders = JSON.parse(localStorage.getItem('printOrders') || '[]');
            const idx = localOrders.findIndex(o => o.id === orderId || o.createdAt === orderId);
            if (idx !== -1) {
                const order = localOrders[idx];
                const prev = order.status;
                order.status = newStatus;
                localStorage.setItem('printOrders', JSON.stringify(localOrders));

                // Process offline refund if rejected
                if (newStatus === 'Rejected' && prev !== 'Rejected' && prev !== 'Cancelled') {
                    const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
                    if (student) {
                        const refundPages = order.pages * order.copies;
                        const refundCost = order.estimatedCost;

                        if (order.paymentMethod === 'Quota') {
                            student.usedPages = Math.max((student.usedPages || 50) - refundPages, 0);
                        } else {
                            student.walletBalance = (student.walletBalance || 1250) + refundCost;
                        }
                        localStorage.setItem('currentStudent', JSON.stringify(student));
                    }

                    // Log credit refund offline
                    const refundTxn = {
                        id: 'txn_' + Date.now(),
                        referenceId: 'TXN-' + Math.floor(10000 + Math.random() * 90000),
                        type: order.paymentMethod === 'Quota' ? 'Admin Quota Refund' : 'Admin Wallet Refund',
                        amount: order.paymentMethod === 'Quota' ? 0 : order.estimatedCost,
                        status: 'Success',
                        createdAt: new Date().toISOString()
                    };
                    const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
                    localTxns.unshift(refundTxn);
                    localStorage.setItem('transactions', JSON.stringify(localTxns));
                }

                alert(`Print request successfully marked as ${newStatus} (Offline mode).`);
                refreshAdminQueue();
                refreshAdminStats();
            }
        });
    };

    // Bind filter listeners
    document.getElementById('queueFilterTerminal')?.addEventListener('change', renderAdminQueueTable);
    document.getElementById('queueFilterStatus')?.addEventListener('change', renderAdminQueueTable);


    // ── Printers Terminal View (View 2) ──
    const refreshAdminPrinters = () => {
        fetch('/api/admin/printers', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : [])
        .then(printers => {
            adminCachedPrinters = printers;
            renderAdminPrinters();
        })
        .catch(err => {
            console.warn('Failed fetching printers API, loading locally...', err);
            
            // Check custom offline storage
            let offlinePrinters = JSON.parse(localStorage.getItem('adminPrinters') || '[]');
            if (offlinePrinters.length === 0) {
                offlinePrinters = [
                    { id: 1, name: 'Central Library - T1', location: 'Central Library, Ground Floor', status: 'Online', paperCount: 420 },
                    { id: 2, name: 'CSE Lab - T2', location: 'CSE Dept, 3rd Floor', status: 'Online', paperCount: 15 },
                    { id: 3, name: 'Science Building - T3', location: 'Science Building Lobby', status: 'Offline', paperCount: 0 }
                ];
                localStorage.setItem('adminPrinters', JSON.stringify(offlinePrinters));
            }
            adminCachedPrinters = offlinePrinters;
            renderAdminPrinters();
        });
    };

    const renderAdminPrinters = () => {
        const grid = document.getElementById('adminPrintersGrid');
        if (!grid) return;

        grid.innerHTML = '';

        adminCachedPrinters.forEach(p => {
            const card = document.createElement('article');
            card.className = 'printer-card';
            
            const isOnline = (p.status || 'Online').toLowerCase() === 'online';
            const isPaperLow = (p.paperCount || 0) < 50;

            card.innerHTML = `
                <div class="printer-header">
                    <h4 class="printer-name">${p.name}</h4>
                    <span class="printer-status-badge ${isOnline ? 'online' : 'offline'}">${p.status}</span>
                </div>
                <div class="printer-details">
                    <div>📍 <strong>Location:</strong> ${p.location}</div>
                    <div>📄 <strong>Paper supply:</strong> <span style="font-weight: 700; color: ${isPaperLow ? '#ef4444' : 'var(--text)'}">${p.paperCount || 0} sheets</span> ${isPaperLow ? '⚠️' : ''}</div>
                </div>
                <div class="printer-actions">
                    <button type="button" class="printer-btn ${isOnline ? 'toggle-offline' : 'toggle-online'}">${isOnline ? '🔌 Set Offline' : '🔌 Set Online'}</button>
                    <button type="button" class="printer-btn refuel-paper">📥 Refill Paper</button>
                </div>
            `;

            // Toggle Online/Offline click
            card.querySelector('.printer-btn:not(.refuel-paper)').addEventListener('click', () => {
                const nextStatus = isOnline ? 'Offline' : 'Online';
                updatePrinterState(p.id, { status: nextStatus });
            });

            // Refill click
            card.querySelector('.refuel-paper').addEventListener('click', () => {
                updatePrinterState(p.id, { paperCount: 500 });
            });

            grid.appendChild(card);
        });
    };

    const updatePrinterState = (printerId, bodyFields) => {
        fetch(`/api/admin/printers/${printerId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bodyFields)
        })
        .then(res => {
            if (!res.ok) throw new Error('Printer update failed');
            return res.json();
        })
        .then(() => {
            alert('Printer state modified successfully.');
            refreshAdminPrinters();
        })
        .catch(err => {
            console.warn('Printer API update failed, using offline fallback...', err);
            
            const localPrinters = JSON.parse(localStorage.getItem('adminPrinters') || '[]');
            const idx = localPrinters.findIndex(p => p.id === printerId);
            if (idx !== -1) {
                const printer = localPrinters[idx];
                if (bodyFields.status) printer.status = bodyFields.status;
                if (bodyFields.paperCount !== undefined) printer.paperCount = bodyFields.paperCount;
                localStorage.setItem('adminPrinters', JSON.stringify(localPrinters));

                alert('Printer state modified successfully (Offline fallback).');
                refreshAdminPrinters();
            }
        });
    };


    // ── Student Account management (View 3) ──
    let selectedStudentForRecharge = null;

    const refreshAdminStudents = () => {
        fetch('/api/admin/students', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : [])
        .then(students => {
            adminCachedStudents = students;
            renderAdminStudentsTable();
        })
        .catch(err => {
            console.warn('Student list API failed, loading local user...', err);
            
            // Offline fallback
            const registeredStudent = JSON.parse(localStorage.getItem('registeredStudent') || 'null');
            const currentStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null');
            
            const usersList = [];
            if (registeredStudent && registeredStudent.role !== 'Admin') usersList.push(registeredStudent);
            if (currentStudent && currentStudent.role !== 'Admin' && !usersList.some(u => u.rollId === currentStudent.rollId)) {
                usersList.push(currentStudent);
            }

            // Fill default fallback if none
            if (usersList.length === 0) {
                usersList.push({
                    id: 1,
                    fullName: 'Ava Nguyen',
                    rollId: '4010',
                    department: 'Computer Science',
                    email: 'ava.nguyen@univ.edu',
                    session: '2022-23',
                    semester: '8th',
                    walletBalance: 1250.00,
                    usedPages: 24,
                    totalPages: 100,
                    status: 'Active'
                });
            }

            adminCachedStudents = usersList;
            renderAdminStudentsTable();
        });
    };

    const renderAdminStudentsTable = () => {
        const tbody = document.querySelector('#adminStudentsTable tbody');
        if (!tbody) return;

        const searchQuery = (document.getElementById('studentSearch')?.value || '').trim().toLowerCase();

        const filtered = adminCachedStudents.filter(s => {
            return s.rollId.toLowerCase().includes(searchQuery) || 
                   s.fullName.toLowerCase().includes(searchQuery) ||
                   s.department.toLowerCase().includes(searchQuery);
        });

        tbody.innerHTML = '';

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--muted); padding: 24px;">No student records found.</td></tr>`;
            return;
        }

        filtered.forEach(s => {
            const tr = document.createElement('tr');
            const quotaLeft = (s.totalPages || 100) - (s.usedPages || 0);

            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700; color: var(--text);">${s.fullName}</div>
                    <small style="color: var(--muted); font-size: 0.72rem;">${s.email}</small>
                </td>
                <td>
                    <div>Roll-${s.rollId}</div>
                    <small style="color: var(--muted); font-size: 0.72rem;">${s.department}</small>
                </td>
                <td>${quotaLeft} / ${s.totalPages || 100} pages</td>
                <td>৳ ${(s.walletBalance || 0).toFixed(2)}</td>
                <td><span class="status-badge completed">${s.status || 'Active'}</span></td>
                <td style="text-align: right;">
                    <button type="button" class="admin-btn btn-process open-recharge-modal">⚡ Recharge</button>
                </td>
            `;

            // Open recharge modal
            tr.querySelector('.open-recharge-modal').addEventListener('click', () => {
                selectedStudentForRecharge = s;
                
                const rechargeStudentName = document.getElementById('rechargeStudentName');
                if (rechargeStudentName) {
                    rechargeStudentName.textContent = `${s.fullName} (Roll-${s.rollId})`;
                }
                
                document.getElementById('rechargeWalletAmount').value = '';
                document.getElementById('rechargeQuotaAmount').value = '';
                document.getElementById('rechargeModal').style.display = 'flex';
            });

            tbody.appendChild(tr);
        });
    };

    // Modal Close actions
    const closeRechargeModal = () => {
        document.getElementById('rechargeModal').style.display = 'none';
        selectedStudentForRecharge = null;
    };

    document.getElementById('closeRechargeBtn')?.addEventListener('click', closeRechargeModal);
    document.getElementById('cancelRechargeBtn')?.addEventListener('click', closeRechargeModal);

    // Recharge adjustments Form Submit
    document.getElementById('rechargeForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedStudentForRecharge) return;

        const walletAdd = parseFloat(document.getElementById('rechargeWalletAmount').value) || 0;
        const quotaAdd = parseInt(document.getElementById('rechargeQuotaAmount').value) || 0;

        if (walletAdd === 0 && quotaAdd === 0) {
            alert('Please input a wallet amount or quota pages to recharge.');
            return;
        }

        const studentId = selectedStudentForRecharge.id;

        fetch(`/api/admin/students/${studentId}/adjust`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ amount: walletAdd, quotaAdjustment: quotaAdd })
        })
        .then(res => {
            if (!res.ok) throw new Error('Recharge adjust failed');
            return res.json();
        })
        .then(() => {
            alert('Recharge successfully applied to student account!');
            closeRechargeModal();
            refreshAdminStudents();
            refreshAdminStats();
        })
        .catch(err => {
            console.warn('API Recharge failed, applying local recharge adjustment...', err);
            
            // Offline fallbacks student adjusting
            const registeredStudent = JSON.parse(localStorage.getItem('registeredStudent') || 'null');
            const currentStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null');

            // Apply adjustment to localStorage references
            const adjust = (s) => {
                if (s && s.id === studentId) {
                    s.walletBalance = (s.walletBalance || 0) + walletAdd;
                    s.totalPages = (s.totalPages || 100) + quotaAdd;
                }
            };
            
            adjust(registeredStudent);
            adjust(currentStudent);

            if (registeredStudent) localStorage.setItem('registeredStudent', JSON.stringify(registeredStudent));
            if (currentStudent) localStorage.setItem('currentStudent', JSON.stringify(currentStudent));

            // Log mock recharge transactions offline
            const localTxns = JSON.parse(localStorage.getItem('transactions') || '[]');
            if (walletAdd > 0) {
                localTxns.unshift({
                    id: 'txn_' + Date.now(),
                    referenceId: 'TXN-' + Math.floor(10000 + Math.random() * 90000),
                    type: 'Admin Cash Top-up',
                    amount: walletAdd,
                    status: 'Success',
                    createdAt: new Date().toISOString()
                });
            }
            if (quotaAdd > 0) {
                localTxns.unshift({
                    id: 'txn_' + (Date.now() + 1),
                    referenceId: 'TXN-' + Math.floor(10000 + Math.random() * 90000),
                    type: 'Admin Quota Adjustment',
                    amount: 0,
                    status: 'Success',
                    createdAt: new Date().toISOString()
                });
            }
            localStorage.setItem('transactions', JSON.stringify(localTxns));

            alert('Recharge successfully applied to student account (Offline fallback).');
            closeRechargeModal();
            refreshAdminStudents();
            refreshAdminStats();
        });
    });

    // Search trigger
    document.getElementById('studentSearch')?.addEventListener('input', renderAdminStudentsTable);


    // ── System settings Configuration Form (View 4) ──
    document.getElementById('adminSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const priceBW = parseFloat(document.getElementById('basePriceBW').value) || 2.0;
        const priceColor = parseFloat(document.getElementById('basePriceColor').value) || 5.0;
        const legalSurcharge = parseFloat(document.getElementById('surchargeLegal').value) || 1.0;

        const globalSettings = { priceBW, priceColor, legalSurcharge };
        localStorage.setItem('adminGlobalPricing', JSON.stringify(globalSettings));
        
        alert('Global pricing configurations saved successfully!');
    });

    // Seed/Load global pricing configurations
    const loadGlobalSettings = () => {
        const saved = JSON.parse(localStorage.getItem('adminGlobalPricing') || 'null');
        if (saved) {
            if (document.getElementById('basePriceBW')) document.getElementById('basePriceBW').value = saved.priceBW;
            if (document.getElementById('basePriceColor')) document.getElementById('basePriceColor').value = saved.priceColor;
            if (document.getElementById('surchargeLegal')) document.getElementById('surchargeLegal').value = saved.legalSurcharge;
        }
    };


    // ── Initialize Dashboard Loadups ──
    refreshAdminStats();
    refreshAdminQueue();
    loadGlobalSettings();
});
