const fs = require('fs');
const path = require('path');

const PAYMENTS_FILE = path.join(__dirname, '..', 'data', 'payments.json');

function ensurePaymentsFile() {
  const dir = path.dirname(PAYMENTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(PAYMENTS_FILE)) {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify([], null, 2));
  }
}

function getPayments() {
  ensurePaymentsFile();
  return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8'));
}

function savePayments(payments) {
  ensurePaymentsFile();
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2));
}

function addPayment(payment) {
  const payments = getPayments();
  payments.push(payment);
  savePayments(payments);
  return payment;
}

function findPaymentById(id) {
  return getPayments().find((p) => String(p.id) === String(id)) || null;
}

function updatePayment(id, patch) {
  const payments = getPayments();
  const index = payments.findIndex((p) => String(p.id) === String(id));
  if (index === -1) return null;
  payments[index] = { ...payments[index], ...patch, updatedAt: new Date().toISOString() };
  savePayments(payments);
  return payments[index];
}

function clearPayments() {
  savePayments([]);
}

module.exports = {
  getPayments,
  savePayments,
  addPayment,
  findPaymentById,
  updatePayment,
  clearPayments,
};
