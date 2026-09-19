const app = require('./app');
const { connectMongo } = require('./config/mongo');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

connectMongo().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});