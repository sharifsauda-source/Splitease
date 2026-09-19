function computeBalances(expenses, splits) {
  const balances = {};
  for (const e of expenses) {
    balances[e.paid_by] = (balances[e.paid_by] || 0) + Number(e.amount_in_base_currency);
  }
  for (const s of splits) {
    balances[s.user_id] = (balances[s.user_id] || 0) - Number(s.share_amount);
  }
  return balances;
}

function simplifyDebts(balances) {
  const creditors = [];
  const debtors = [];
  for (const [userId, amount] of Object.entries(balances)) {
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > 0.01) creditors.push({ userId, amount: rounded });
    else if (rounded < -0.01) debtors.push({ userId, amount: -rounded });
  }
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    transactions.push({ from: debtors[i].userId, to: creditors[j].userId, amount: +pay.toFixed(2) });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }
  return transactions;
}

module.exports = { computeBalances, simplifyDebts };