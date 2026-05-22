const { MongoClient } = require('mongodb');



module.exports = {
  connectToDb: (cb) => {
    MongoClient.connect('mongodb://localhost:27017/NearMe')
    .then(client => {
      dbConnection = client.db();
      return cb();
    })
    .catch(err => {
      console.error('Failed to connect to the database')
      return cb(err);
    });
  },
  getDb: () => dbConnection
}