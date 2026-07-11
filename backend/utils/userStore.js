const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

function ensureUsersFile() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
  }
}

function getUsers() {
  ensureUsersFile();
  const data = fs.readFileSync(USERS_FILE, 'utf8');
  return JSON.parse(data);
}

function saveUsers(users) {
  ensureUsersFile();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserByEmail(email) {
  const users = getUsers();
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

module.exports = {
  getUsers,
  saveUsers,
  findUserByEmail,
};
