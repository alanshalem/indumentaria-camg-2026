import { supabase } from '../lib/supabase.js';

const LAST_CODE_KEY = 'camg_last_order_code';
const LAST_DATE_KEY = 'camg_last_order_date';

function rowToOrder(row) {
  return {
    code: row.code,
    timestamp: new Date(row.created_at).getTime(),
    customerName: row.customer_name,
    customerLastName: row.customer_last_name,
    items: row.items || [],
    total: row.total || 0,
    status: row.status || 'pending',
  };
}

export async function readOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('readOrders error:', error);
    return [];
  }
  return (data || []).map(rowToOrder);
}

export async function addOrder(order) {
  const { error } = await supabase.from('orders').insert({
    code: order.code,
    customer_name: order.customerName,
    customer_last_name: order.customerLastName,
    items: order.items,
    total: order.total || 0,
    status: order.status || 'pending',
  });
  if (error) {
    console.error('addOrder error:', error);
    throw error;
  }
}

export async function updateOrder(code, patch) {
  const dbPatch = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  const { error } = await supabase.from('orders').update(dbPatch).eq('code', code);
  if (error) {
    console.error('updateOrder error:', error);
    throw error;
  }
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
  document.cookie = `camg_order_code=${code}; max-age=31536000; path=/`;
}

export function clearLastOrderRef() {
  localStorage.removeItem(LAST_CODE_KEY);
  localStorage.removeItem(LAST_DATE_KEY);
  document.cookie = 'camg_order_code=; max-age=0; path=/';
}
