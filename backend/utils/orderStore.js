const fs = require('fs');
const path = require('path');

const ORDERS_FILE = path.join(__dirname, '..', 'data', 'orders.json');

function ensureOrdersFile() {
  const dir = path.dirname(ORDERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2));
  }
}

function getOrders() {
  ensureOrdersFile();
  return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
}

function saveOrders(orders) {
  ensureOrdersFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function addOrder(order) {
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
}

function findOrderById(id) {
  return getOrders().find((o) => String(o.id) === String(id)) || null;
}

function updateOrder(id, patch) {
  const orders = getOrders();
  const index = orders.findIndex((o) => String(o.id) === String(id));
  if (index === -1) return null;
  orders[index] = { ...orders[index], ...patch, updatedAt: new Date().toISOString() };
  saveOrders(orders);
  return orders[index];
}

function getOrdersByEmail(email) {
  if (!email) return getOrders();
  const normalized = email.trim().toLowerCase();
  return getOrders().filter((o) => (o.studentEmail || '').toLowerCase() === normalized);
}

function clearOrders() {
  saveOrders([]);
}

function filterOrders(orders, query = {}) {
  let result = [...orders];

  if (query.email) {
    const email = String(query.email).toLowerCase();
    result = result.filter((o) => (o.studentEmail || '').toLowerCase() === email);
  }

  if (query.status) {
    const status = String(query.status).toLowerCase();
    result = result.filter((o) => (o.status || '').toLowerCase() === status);
  }

  if (query.q) {
    const q = String(query.q).toLowerCase();
    result = result.filter((o) => {
      const haystack = [
        o.documentName,
        o.studentEmail,
        o.printerTerminal,
        o.paperSize,
        o.colorMode,
        o.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (query.from) {
    const from = new Date(query.from).getTime();
    result = result.filter((o) => new Date(o.createdAt).getTime() >= from);
  }

  if (query.to) {
    const to = new Date(query.to).getTime();
    result = result.filter((o) => new Date(o.createdAt).getTime() <= to);
  }

  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  getOrders,
  saveOrders,
  addOrder,
  findOrderById,
  updateOrder,
  getOrdersByEmail,
  clearOrders,
  filterOrders,
  ORDERS_FILE,
};
