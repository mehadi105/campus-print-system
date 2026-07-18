document.addEventListener('DOMContentLoaded', () => {
    const currentPage = document.body.dataset.page;
    const messageBox = document.getElementById('message');

    function showMessage(text, type = 'info') {
        if (!messageBox) return;

        messageBox.textContent = text;
        messageBox.style.display = 'block';
        messageBox.style.padding = '12px 14px';
        messageBox.style.borderRadius = '8px';
        messageBox.style.marginBottom = '16px';
        messageBox.style.fontWeight = '600';
        messageBox.style.textAlign = 'center';
        messageBox.style.color = '#fff';

        if (type === 'success') {
            messageBox.style.backgroundColor = '#2e7d32';
        } else if (type === 'error') {
            messageBox.style.backgroundColor = '#c62828';
        } else {
            messageBox.style.backgroundColor = '#1976d2';
        }
    }

    function getInitials(fullName) {
        if (!fullName) return 'ST';
        const parts = fullName.trim().split(/\s+/);
        const first = parts[0]?.[0] || '';
        const last = parts[1]?.[0] || '';
        return (first + last).toUpperCase();
    }

    function renderStudentData(student) {
        if (!student) return;

        document.querySelectorAll('.student-name-display').forEach((el) => {
            el.textContent = student.fullName || 'Student';
        });

        document.getElementById('student-id').textContent = student.rollId || '';
        document.getElementById('student-dept').textContent = student.department || '';
        document.getElementById('student-email').textContent = student.email || '';
        document.getElementById('student-semester').textContent = student.semester || '';
        document.getElementById('student-session').textContent = student.session || '';
        document.getElementById('student-status').textContent = student.status || 'Active';

        const quotaText = document.getElementById('quota-text');
        const quotaProgress = document.getElementById('quota-progress');
        const walletBalance = document.getElementById('wallet-balance');
        const avatarButtons = document.querySelectorAll('.profile-avatar-btn, .avatar');

        const quotaTextBilling = document.getElementById('quota-text-billing');
        const quotaProgressBilling = document.getElementById('quota-progress-billing');
        const walletBalanceBilling = document.getElementById('wallet-balance-billing');

        if (quotaText) {
            const used = student.usedPages || 50;
            const total = student.totalPages || 100;
            const left = Math.max(total - used, 0);
            quotaText.textContent = `Free Pages Left: ${left} / ${total}`;
        }

        if (quotaProgress) {
            const used = student.usedPages || 50;
            const total = student.totalPages || 100;
            const percent = Math.min(Math.max((used / total) * 100, 0), 100);
            quotaProgress.style.width = `${percent}%`;
        }

        if (walletBalance) {
            walletBalance.textContent = student.walletBalance ? `৳ ${student.walletBalance}` : '৳ 0';
        }

        if (quotaTextBilling) {
            const used = student.usedPages || 50;
            const total = student.totalPages || 100;
            const left = Math.max(total - used, 0);
            quotaTextBilling.textContent = `Free Pages Left: ${left} / ${total}`;
        }

        if (quotaProgressBilling) {
            const used = student.usedPages || 50;
            const total = student.totalPages || 100;
            const percent = Math.min(Math.max((used / total) * 100, 0), 100);
            quotaProgressBilling.style.width = `${percent}%`;
        }

        if (walletBalanceBilling) {
            walletBalanceBilling.textContent = student.walletBalance ? `৳ ${student.walletBalance}` : '৳ 0';
        }

        const walletBalanceUpload = document.getElementById('upload-wallet-balance');
        if (walletBalanceUpload) {
            walletBalanceUpload.textContent = student.walletBalance ? `৳ ${student.walletBalance}` : '৳ 0';
        }

        avatarButtons.forEach((button) => {
            button.textContent = getInitials(student.fullName);
        });

        const heroTitle = document.querySelector('.hero-strip h2');
        if (heroTitle) {
            heroTitle.textContent = `Good morning, ${student.fullName?.split(' ')[0] || 'Student'}`;
        }
    }

    // Expose sync function globally so script.js can update the UI
    window.syncProfileDisplay = renderStudentData;

    if (currentPage === 'dashboard') {
        const currentStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null');

        if (!currentStudent) {
            window.location.href = 'index.html';
            return;
        }

        renderStudentData(currentStudent);

        const profileAvatarBtn = document.getElementById('profileAvatarBtn');
        const sidebarProfileCard = document.getElementById('sidebarProfileCard');
        const logoutBtn = document.getElementById('logoutBtn');
        const modal = document.getElementById('profileModal');
        const closeModalBtn = document.getElementById('closeModalBtn');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editProfileForm = document.getElementById('editProfileForm');
        const editName = document.getElementById('editName');
        const editEmail = document.getElementById('editEmail');
        const editDepartment = document.getElementById('editDepartment');

        const openProfileModal = () => {
            const refreshedStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null') || currentStudent;
            if (editName && editEmail && editDepartment) {
                editName.value = refreshedStudent.fullName || '';
                editEmail.value = refreshedStudent.email || '';
                editDepartment.value = refreshedStudent.department || '';
            }
            modal?.classList.add('open');
        };

        profileAvatarBtn?.addEventListener('click', openProfileModal);
        sidebarProfileCard?.addEventListener('click', openProfileModal);

        const closeModal = () => modal?.classList.remove('open');

        closeModalBtn?.addEventListener('click', closeModal);
        cancelEditBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        editProfileForm?.addEventListener('submit', (event) => {
            event.preventDefault();

            const refreshedStudent = JSON.parse(localStorage.getItem('currentStudent') || 'null') || currentStudent;
            const updatedStudent = {
                ...refreshedStudent,
                fullName: editName.value.trim(),
                email: editEmail.value.trim(),
                department: editDepartment.value.trim()
            };

            localStorage.setItem('currentStudent', JSON.stringify(updatedStudent));
            localStorage.setItem('registeredStudent', JSON.stringify(updatedStudent));
            renderStudentData(updatedStudent);
            closeModal();
            showMessage('Profile updated successfully.', 'success');
        });

        logoutBtn?.addEventListener('click', () => {
            localStorage.removeItem('currentStudent');
            window.location.href = 'index.html';
        });
    }

    if (currentPage !== 'dashboard') {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        const handleRegister = (event) => {
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

            const student = {
                fullName,
                rollId,
                department,
                email,
                session,
                semester,
                password,
                status: 'Active',
                walletBalance: 1250,
                usedPages: 50,
                totalPages: 100
            };

            localStorage.setItem('registeredStudent', JSON.stringify(student));
            showMessage('Account created successfully. Redirecting to login...', 'success');

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 700);
        };

        const handleLogin = (event) => {
            if (event) event.preventDefault();

            const credential = document.getElementById('email')?.value.trim();
            const password = document.getElementById('password')?.value.trim();

            if (!credential || !password) {
                showMessage('Please fill in both fields.', 'error');
                return;
            }

            const registeredStudent = JSON.parse(localStorage.getItem('registeredStudent') || 'null');

            if (!registeredStudent) {
                showMessage('No account found. Please register first.', 'error');
                return;
            }

            const isMatch = (registeredStudent.email === credential || registeredStudent.rollId === credential) && registeredStudent.password === password;

            if (!isMatch) {
                showMessage('Invalid email/roll ID or password.', 'error');
                return;
            }

            localStorage.setItem('currentStudent', JSON.stringify(registeredStudent));
            showMessage('Login successful. Redirecting...', 'success');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 700);
        };

        registerForm?.addEventListener('submit', handleRegister);
        loginForm?.addEventListener('submit', handleLogin);
    }
});
