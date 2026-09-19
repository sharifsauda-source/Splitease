const pool = require('../config/db');

async function createGroup(req, res) {
  const { name, base_currency } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const groupResult = await client.query(
      'INSERT INTO groups (name, base_currency, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, base_currency || 'BDT', req.user.id]
    );
    const group = groupResult.rows[0];
    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(group);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
}

async function addMember(req, res) {
  const groupId = req.params.id;
  const { user_id } = req.body;

  const isMember = await pool.query(
    'SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2',
    [groupId, req.user.id]
  );
  if (isMember.rowCount === 0) return res.status(403).json({ error: 'Not a group member' });

  await pool.query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [groupId, user_id]
  );
  res.status(201).json({ added: user_id });
}

async function getGroup(req, res) {
  const groupId = req.params.id;
  const group = await pool.query('SELECT * FROM groups WHERE id=$1', [groupId]);
  if (group.rowCount === 0) return res.status(404).json({ error: 'Not found' });

  const members = await pool.query(
    `SELECT u.id, u.name, u.email FROM group_members gm
     JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`,
    [groupId]
  );
  res.json({ ...group.rows[0], members: members.rows });
}

module.exports = { createGroup, addMember, getGroup };