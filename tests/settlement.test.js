const { computeBalances, simplifyDebts } = require('../src/utils/settlement');

test('everyone owes nothing when balances are zero', () => {
  const balances = { 1: 0, 2: 0 };
  expect(simplifyDebts(balances)).toEqual([]);
});

test('one person paid for everything - two others owe them', () => {
  const expenses = [{ paid_by: '1', amount_in_base_currency: 300 }];
  const splits = [
    { user_id: '1', share_amount: 100 },
    { user_id: '2', share_amount: 100 },
    { user_id: '3', share_amount: 100 }
  ];
  const balances = computeBalances(expenses, splits);
  const tx = simplifyDebts(balances);
  expect(tx.length).toBe(2);
  const totalPaid = tx.reduce((sum, t) => sum + t.amount, 0);
  expect(totalPaid).toBeCloseTo(200);
});

test('already-settled group produces no transactions', () => {
  const expenses = [{ paid_by: '1', amount_in_base_currency: 100 }];
  const splits = [
    { user_id: '1', share_amount: 50 },
    { user_id: '2', share_amount: 50 }
  ];
  const balances = computeBalances(expenses, splits);
  // manually settle: user 2 pays user 1 the 50 they owe
  balances['1'] -= 50;
  balances['2'] += 50;
  expect(simplifyDebts(balances)).toEqual([]);
});