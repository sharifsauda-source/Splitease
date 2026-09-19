const express = require('express');
const authRoutes = require('./routes/authRoutes');
const groupRoutes = require('./routes/groupRoutes');

const app = express();
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/groups', groupRoutes);

module.exports = app;