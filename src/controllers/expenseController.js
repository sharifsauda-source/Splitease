const pool = require('../config/db');
const { getDb } = require('../config/mongo');
const redis = require('../config/redis');
const { computeBalances, simplifyDebts } = require('../utils/settlement');
const { getRate } = require('../utils/currency');

async function addExpense(req, res) {
  const groupId = req.params.id;
  const { description, amount, currency, splits } = req.body;

  const members = await pool.query('SELECT user_id FROM group_members WHERE group_id=$1', [groupId]);
  const memberIds = members.rows.map(r => r.user_id);
  if (!memberIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'Not a group member' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query('SELECT base_currency FROM groups WHERE id=$1', [groupId]);
const baseCurrency = groupResult.rows[0].base_currency;
const expenseCurrency = currency || baseCurrency;

let amountInBase = amount;
if (expenseCurrency !== baseCurrency) {
  const rate = await getRate(expenseCurrency, baseCurrency);
  amountInBase = +(amount * rate).toFixed(2);
}

const expenseResult = await client.query(
  `INSERT INTO expenses (group_id, paid_by, description, amount, currency, amount_in_base_currency)
   VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
  [groupId, req.user.id, description, amount, expenseCurrency, amountInBase]
);
const expense = expenseResult.rows[0];
    let finalSplits = splits;
    if (!finalSplits) {
      const share = +(amount / memberIds.length).toFixed(2);
      finalSplits = memberIds.map(uid => ({ user_id: uid, share_amount: share }));
    }
    for (const s of finalSplits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, share_amount) VALUES ($1,$2,$3)',
        [expense.id, s.user_id, s.share_amount]
      );
    }
    await client.query('COMMIT');

    await getDb().collection('activity_log').insertOne({
      group_id: +groupId,
      type: 'expense_added',
      actor_user_id: req.user.id,
      details: { expense_id: expense.id, amount, description },
      timestamp: new Date()
    });

    await redis.del(`group:${groupId}:balances`);

    res.status(201).json({ expense, splits: finalSplits });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

async function getActivity(req, res) {
  const groupId = +req.params.id;
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 20);

  const items = await getDb().collection('activity_log')
    .find({ group_id: groupId })
    .sort({ timestamp: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  res.json(items);
}


async function getBalances(req, res) {
  const groupId = req.params.id;

  const cached = await redis.get(`group:${groupId}:balances`);
  if (cached) return res.json(JSON.parse(cached));

  const expenses = await pool.query('SELECT * FROM expenses WHERE group_id=$1', [groupId]);
  const splits = await pool.query(
    `SELECT es.* FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id WHERE e.group_id=$1`,
    [groupId]
  );

  const balances = computeBalances(expenses.rows, splits.rows);
  const transactions = simplifyDebts(balances);

  await redis.set(`group:${groupId}:balances`, JSON.stringify(transactions));
  res.json(transactions);
}


module.exports = { addExpense, getActivity, getBalances };