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

### View Documents API (SCRUM-36)

**List documents:** `GET /api/documents`

Optional filter by student email (matches dashboard / document list UI):

`GET /api/documents?email=student@university.edu`

**Success response (200):**
```json
{
  "success": true,
  "message": "Documents retrieved successfully",
  "count": 1,
  "documents": [
    {
      "id": "doc-1710000000000",
      "fileName": "assignment.pdf",
      "originalName": "assignment.pdf",
      "mimeType": "application/pdf",
      "size": 245760,
      "uploadedBy": "student@university.edu",
      "uploadedAt": "2026-07-17T08:00:00.000Z",
      "status": "ready"
    }
  ]
}
```

**Get one document:** `GET /api/documents/:id`

**Error responses:**
- `404` - Document not found

### Frontend Integration (Document List)

Ready for Imtiaj's document list UI (`SCRUM-35` / `SCRUM-37`):

```javascript
const email = currentStudent.email;
const response = await fetch(
  `http://localhost:3000/api/documents?email=${encodeURIComponent(email)}`
);
const data = await response.json();
// data.documents → render list / cards
```

### Document Management Tests (SCRUM-39)

Run the automated tests for document storage and the view documents API:

```bash
npm test
```

Coverage includes:
- add / list / filter / find / delete in the document store
- `GET /api/documents` and `GET /api/documents/:id`
- email filter used by the document list UI
- end-to-end management flow: add → list → view → delete
