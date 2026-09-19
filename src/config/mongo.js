const { MongoClient } = require('mongodb');
require('dotenv').config();

let db;
async function connectMongo() {
  const client = new MongoClient(process.env.MONGO_URL);
  await client.connect();
  db = client.db();
  console.log('Mongo connected');
  return db;
}
function getDb() {
  if (!db) throw new Error('Mongo not connected yet');
  return db;
}
module.exports = { connectMongo, getDb };