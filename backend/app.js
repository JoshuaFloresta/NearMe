const express = require('express');
const { connectToDb, getDb } = require('./db');

const app = express();
let db;


connectToDb((err) => {
  if (err) {
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  })
  db = getDb();
  }
});

app.get('/users', (req, res) => {
  res.json('Welcome to NearMe API');
});


