# campus-print-system

Campus Printing System for university students.

## Backend API (SCRUM-19: Login + SCRUM-20: Register)

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

### Register API

**Endpoint:** `POST /api/auth/register`

**Request body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "student@university.edu",
  "password": "yourpassword",
  "gender": "male"
}
```

**Success response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "user": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "student@university.edu",
    "gender": "male"
  }
}
```

**Error responses:**
- `400` - Missing fields, missing gender, or password too short
- `409` - Email already registered

### Frontend Integration (Register)

Matches Imtiaz's register page (`register.html`) fields:
- `firstName` - First name
- `lastName` - Surname
- `email` - Email address
- `password` - New password (min 6 characters)
- `gender` - `female`, `male`, or `custom`

Example fetch from register page:
```javascript
const response = await fetch('http://localhost:3000/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ firstName, lastName, email, password, gender: gender.value })
});
const data = await response.json();
```

### Dashboard API (SCRUM-24)

**Endpoint:** `GET /api/dashboard?email=student@university.edu`

Returns student profile, print quota, wallet, and recent activity for Imtiaj's dashboard UI.

**Success response (200):** student object + stats + recentActivity

**Error responses:**
- `400` - Missing email
- `404` - Student not found

Example:
```javascript
const response = await fetch(
  'http://localhost:3000/api/dashboard?email=' + encodeURIComponent(email)
);
const data = await response.json();
```

### Dashboard Tests (SCRUM-26)

```bash
npm test
```

Covers missing email, unknown student, and successful dashboard payload for Imtiaj's UI fields.

### File Upload API (SCRUM-30)

**Endpoint:** `POST /api/uploads`

Multipart form fields:
- `file` — document file
- `email` — student email (owner)

**Success response (201):** uploaded document metadata

Files are stored under `backend/uploads/` and metadata in the documents store for later listing.

### Upload Validation (SCRUM-31)

Enforced limits matching the upload UI:
- Allowed types: `.pdf`, `.docx`, `.pptx`
- Max size: **25 MB** per file

Invalid type/size requests return `400` with a clear message.
