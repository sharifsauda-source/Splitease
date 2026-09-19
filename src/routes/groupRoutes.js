const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { createGroup, addMember, getGroup } = require('../controllers/groupController');
const { addExpense, getActivity, getBalances } = require('../controllers/expenseController');

router.use(auth);
router.post('/', createGroup);
router.post('/:id/members', addMember);
router.get('/:id', getGroup);
router.post('/:id/expenses', addExpense);
router.get('/:id/activity', getActivity);
router.get('/:id/balances', getBalances);

module.exports = router;