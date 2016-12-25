"use strict";

var mongodb = require('mongodb');
var collection;

// ------------------------------
// ASYNCHRONOUS PROMISE-BASED API
//  SEE BELOW FOR SYNCHRONOUS API
// ------------------------------

// Serializes an object to JSON and stores it to the database
function set(key, value) {
  return new Promise((resolve, reject) => {
    if (typeof(key) !== "string") {
      reject(new DatastoreKeyNeedToBeStringException(key));
    } else {
      try {
        var serializedValue = JSON.stringify(value);
        collection.updateOne({"key": key}, 
          {$set: {"value": serializedValue}}, {upsert:true}, 
          (err, res) => {
            if (err) {
              reject(new DatastoreUnderlyingException(value, err));
            } else {
              resolve(res);
            }
          }
        );
      } catch (ex) {
        reject(new DatastoreValueSerializationException(value, ex));
      }
    }
  });
}

// Fetches an object from the DynamoDB instance, deserializing it from JSON
function originalGet(key) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof(key) !== "string") {
        reject(new DatastoreKeyNeedToBeStringException(key));
      } else {
        collection.findOne({"key":key}, (err, data) => {
          if (err) {
            reject(new DatastoreUnderlyingException(key, err));
          } else {
            try {
              if (data === null) {
                resolve(null);
              } else {
                resolve(JSON.parse(data.value));
              }
            } catch (ex) {
              reject(new DatastoreDataParsingException(data.value, ex));
            }
          }
        });
      }
    } catch (ex) {
      reject(new DatastoreUnknownException("get", {"key": key}, ex));
    }
  });
}

function getCore(key) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof(key) !== "string") {
        reject(new DatastoreKeyNeedToBeStringException(key));
      } else {
        collection.findOne({"key":key}, (err, data) => {
          if (err) {
            reject(new DatastoreUnderlyingException(key, err));
          } else {
            resolve(data);
          }
        });
      }
    } catch (ex) {
      reject(new DatastoreUnknownException("get", {"key": key}, ex));
    }
  });
}

function get(key) {
  return getCore(key)
    .then(data => {
      if (data === null) {
        return null;
      } else {
        try {
          return JSON.parse('{' + data.value);
        } catch (ex) {
          throw new DatastoreDataParsingException(data.value, ex)
        }
      }
    })
    // .catch(reason => {
    //   // the only reason to get exception is if JSON.parse fails, 
    //   // but we dont have data here in this new code form.
    //   // use to log data.value here but dont have it with split.
    //   // by explict catch of exception above can log the data being parsed to.
    //   throw new DatastoreDataParsingException('not got value at moment', reason)
    // });
}

function remove(key) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof(key) !== "string") {
        reject(new DatastoreKeyNeedToBeStringException(key));
      } else {
        collection.deleteOne({"key": key}, (err, res) => {
          if (err) {
            reject(new DatastoreUnderlyingException(key, err));
          } else {
            resolve(res);
          }
        });
      }
    } catch (ex) {
      reject(new DatastoreUnknownException("remove", {"key": key}, ex));
    }
  });
}

function removeMany(keys) {
  return Promise.all(keys.map((key) => {
    return remove(key);
  }));
}

function connect(connectUri, dbCollection) {
  return new Promise((resolve, reject) => {
    try {
      mongodb.MongoClient.connect(connectUri, (err, db) => {
        if (err) {
          reject(err);
        } else {
          collection = db.collection(dbCollection);
          resolve(collection);
        }
      });
    } catch(ex) {
      reject(new DatastoreUnknownException("connect", null, ex));
    }
  });
}

function DatastoreKeyNeedToBeStringException(keyObject) {
  this.type = this.constructor.name;
  this.description = "Datastore can only use strings as keys, got " + keyObject.constructor.name + " instead.";
  this.key = keyObject;
}

function DatastoreValueSerializationException(value, ex) {
  this.type = this.constructor.name;
  this.description = "Failed to serialize the value to JSON";
  this.value = value;
  this.error = ex;
}

function DatastoreDataParsingException(data, ex) {
  this.type = this.constructor.name;
  this.description = "Failed to deserialize object from JSON";
  this.data = data;
  this.error = ex;
}

function DatastoreUnderlyingException(params, ex) {
  this.type = this.constructor.name;
  this.description = "The underlying DynamoDB instance returned an error";
  this.params = params;
  this.error = ex;
}

function DatastoreUnknownException(method, args, ex) {
  this.type = this.constructor.name;
  this.description = "An unknown error happened during the operation " + method;
  this.method = method;
  this.args = args;
  this.error = ex;
}

function DatastoreFiledConnectException(method, args) {
  this.type = this.constructor.name;
  this.description = "Failed to connecto to database " + method;
  this.method = method;
  this.args = args;
}

// -------------------------------------------
// SYNCHRONOUS WRAPPERS AROUND THE PROMISE API
// -------------------------------------------
// Basic tests of sync done see test-datastore-sync.js
// It is not clear how to use initializeApp.
// so sync code was tested with 
//   sync.fiber(function () { /* tests */ });
//
const sync = require("synchronize");

const doCallback = (func, callback, ...rest) =>
  func(...rest)
    .then(value => callback(null, value))
    .catch(err => callback(err, null));

const wrapAsync = (func, ...rest) => 
  sync.await(doCallback(func, sync.defer(), ...rest));

const setSync        = (...rest) => wrapAsync(set, ...rest);
const getSync        = (...rest) => wrapAsync(get, ...rest);
const removeSync     = (...rest) => wrapAsync(remove, ...rest);
const removeManySync = (...rest) => wrapAsync(removeMany, ...rest);
const connectSync    = (...rest) => wrapAsync(connect, ...rest);

function initializeApp(app) {
  app.use((req, res, next) => sync.fiber(next));
}

const asyncDatastore = {
  set: set,
  get: get,
  remove: remove,
  removeMany: removeMany,
  connect: connect,
};

let syncDatastore = {
  set: setSync,
  get: getSync,
  remove: removeSync,
  removeMany: removeManySync,
  connect: connectSync,
  initializeApp: initializeApp,
};

// try to build syncDataStore from asyncDatastore, not working at moment.
const AsyncDatastore = {};
for (var key in asyncDatastore) {
  // console.log('key', key);
  var func = asyncDatastore[key];
  AsyncDatastore[key] = (...rest) => wrapAsync(func, ...rest);
}
AsyncDatastore.initializeApp = initializeApp;
// syncDatastore = AsyncDatastore;

module.exports = {
  async: asyncDatastore,
  sync: syncDatastore
};
