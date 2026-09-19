const axios = require('axios');
require('dotenv').config();

async function getRate(fromCurrency, toCurrency) {
  try {
    const res = await axios.get(`${process.env.EXCHANGE_RATE_API_URL}/${fromCurrency}`);
    return res.data.rates[toCurrency];
  } catch (err) {
    console.error('Exchange rate fetch failed, defaulting to 1:1', err.message);
    return 1;
  }
}

module.exports = { getRate };