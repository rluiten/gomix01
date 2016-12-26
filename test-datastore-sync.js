"use strict";

// basic test of sync mode datastore.js

const ds = require("./datastore.js");
const datastore = ds.sync;
// Standard URI format: mongodb://[dbuser:dbpassword@]host:port/dbname, details set in .env
var MONGODB_URI = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;

const sync = require('synchronize');
const testId = 'U0259R09K';

function syncMain() {
  console.log('syncMain')
  var db = datastore.connect(MONGODB_URI, process.env.COLLECTION);
  // console.log('pre get');
  var val = datastore.get(testId);  
  console.log('get', val);
  // console.log('pre set');
  var setResult = datastore.set(testId, val+1);
  // console.log('post set');
}

sync.fiber(syncMain);
