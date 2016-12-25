"use strict";

// try out sync mode of datastore

//const ts = require('./tinyspeck.js')
const ds = require("./datastore.js");
const datastore = ds.sync;
// Standard URI format: mongodb://[dbuser:dbpassword@]host:port/dbname, details set in .env
var MONGODB_URI = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;

//const slack = ts.instance({ });
//let connected = false;

const sync = require('synchronize');
const testId = 'U0259R09K';
console.log('index2');

function syncMain() {
  console.log('syncMain')
  var db = datastore.connect(MONGODB_URI, process.env.COLLECTION);
  // console.log('connect db', db);
  var val = datastore.get(testId);  
  console.log('get', val);
  var setResult = datastore.set(testId, val+1);
  
}

sync.fiber(syncMain);

// it is not clear how to use initializeApp ?
// datastore.initializeApp(syncMain);
