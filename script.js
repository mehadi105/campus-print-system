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

        const student = {
            fullName,
            rollId,
            department,
            email: email.toLowerCase(),
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
    }

    function handleLogin(event) {
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

        const isValidLogin = (registeredStudent.email === credential.toLowerCase() || registeredStudent.rollId === credential) && registeredStudent.password === password;

        if (!isValidLogin) {
            showMessage('Invalid email/roll ID or password.', 'error');
            return;
        }

        localStorage.setItem('currentStudent', JSON.stringify(registeredStudent));
        showMessage('Login successful. Redirecting...', 'success');

        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 700);
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

        if (!currentStudent) {
            window.location.href = 'index.html';
            return;
        }

        logoutButton?.addEventListener('click', () => {
            localStorage.removeItem('currentStudent');
            window.location.href = 'index.html';
        });
    }
});
