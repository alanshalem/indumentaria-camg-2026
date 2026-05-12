const ORDERS_KEY = 'camg_orders';
const LAST_CODE_KEY = 'camg_last_order_code';
const LAST_DATE_KEY = 'camg_last_order_date';
const COUNTER_KEY = 'camg_order_counter';

export function readOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeOrders(orders) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

export function addOrder(order) {
  const orders = readOrders();
  orders.unshift(order);
  writeOrders(orders);
}

export function updateOrder(code, patch) {
  const orders = readOrders();
  const next = orders.map(o => (o.code === code ? { ...o, ...patch } : o));
  writeOrders(next);
}

export function getLastOrderRef() {
  const code = localStorage.getItem(LAST_CODE_KEY);
  const date = localStorage.getItem(LAST_DATE_KEY);
  if (!code) return null;
  return { code, date: date ? Number(date) : null };
}

export function setLastOrderRef(code) {
  localStorage.setItem(LAST_CODE_KEY, code);
  localStorage.setItem(LAST_DATE_KEY, String(Date.now()));
  // Cookie persistente (1 año)
  document.cookie = `camg_order_code=${code}; max-age=31536000; path=/`;
}

export function clearLastOrderRef() {
  localStorage.removeItem(LAST_CODE_KEY);
  localStorage.removeItem(LAST_DATE_KEY);
  document.cookie = 'camg_order_code=; max-age=0; path=/';
}

export function nextCounter() {
  const current = Number(localStorage.getItem(COUNTER_KEY) || '0');
  const next = current + 1;
  localStorage.setItem(COUNTER_KEY, String(next));
  return next;
}
