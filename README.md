# campus-print-system

Campus Printing System for university students.

## Backend API (SCRUM-19: Login)

### Setup

```bash
npm install
npm start
```

Server runs at `http://localhost:3000`

### Login API

**Endpoint:** `POST /api/auth/login`

**Request body:**
```json
{
  "email": "student@university.edu",
  "password": "yourpassword"
}
```

**Success response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "student@university.edu",
    "gender": "male"
  }
}
```

**Error responses:**
- `400` - Missing email or password
- `401` - Invalid credentials

### Frontend Integration

Matches Imtiaz's login page (`index.html`) fields:
- `email` - Student Email
- `password` - Password

Example fetch from login page:
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const data = await response.json();
```
