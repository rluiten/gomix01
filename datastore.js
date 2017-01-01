var Sequelize = require('sequelize');
var sequelize = new Sequelize('database', process.env.DB_USER, process.env.DB_PASS, {
  // host: '0.0.0.0',
  // data is stored in memory, change storage type for persistence
  // http://sequelize.readthedocs.io/en/latest/api/sequelize/
  dialect: 'sqlite',
  // pool: {
  //   max: 5,
  //   min: 0,
  //   idle: 10000
  // },
  //storage:':memory:' // default
  // Security note: the database is saved to the file `database.sqlite` on the local filesystem. It's deliberately placed in the `.data` directory
  // which doesn't get copied if someone remixes the project.
  storage: '.data/database.sqlite',
  logging: console.log.bind(console),
  benchmark: true,
});

var Token;
var UserReaction;

// Improved set(). Stores key-value pair in database
function set(key, value) {
  if (typeof(key) !== 'string')
    return Promise.reject(new DatastoreKeyNeedToBeStringException(key));
    
  return Token.find({ where: { key } })
    .then(token => {
      return token
        ? token.update({ value })
        : Token.create({ key, value });
    });
}

// improved get(). Fetches the value matching key from the database.
function get(key) {
  if (typeof(key) !== 'string') 
    return Promise.reject(new DatastoreKeyNeedToBeStringException(key));

  return Token.findOne({ where: { key } }).then(resolveValue);
}

// Untested.
// rewrite... use sequelize promise api in more idiomatic way.
function connect() {
  return sequelize.authenticate()
    .then(_ => {
      console.log('Connection has been established successfully.');
      // side effects set of Token seems not a good idea.
      // define a new table 'token' 
      Token = sequelize.define('token', {
          key: { 
            type: Sequelize.STRING 
          },
          value: { 
            type: Sequelize.STRING 
          },
      });
      UserReaction = sequelize.define('userReaction', {
          userId: { type: Sequelize.STRING },
          reaction: { type: Sequelize.STRING},
          addCount: { type: Sequelize.STRING}, // string so bigger than 32 bit int 
          removeCount: { type: Sequelize.STRING}, // string so bigger than 32 bit int 
      });
      return Promise.all([Token.sync(), UserReaction.sync()]);
    })
    .then(_ => Token)
    .catch(err => {
      console.log('Unable to connect to the database: ', err);
      // throw in a promise then or catch causes promise result to reject.
      throw new DatastoreUnknownException("connect", null, err); // improve err message.
    });
}

function DatastoreKeyNeedToBeStringException(keyObject) {
  this.type = this.constructor.name;
  this.description = `Datastore can only use strings as keys, got ${keyObject.constructor.name} instead.`;
  this.key = keyObject;
}

function DatastoreUnknownException(method, args, ex) {
  this.type = this.constructor.name;
  this.description = "An unknown error happened during the operation " + method;
  this.method = method;
  this.args = args;
  this.error = ex;
}

function resolveValue(data) {
  // console.log('resolveDataValue', data);
  return (data === null) ? null : data.value;
}

// raw: true just the data set not ancillary functions options etc.
// ? , include: { paranoid: true}
function getAll() {
  return Token.findAll({ raw: true });
}

function count() {
  return Token.count();
}

function userReactionCount() {
  return UserReaction.count();
}

function setUserAction(userId, reaction, isAdd) {
  return UserReaction.find({ where: { userId, reaction } })
    .then(userReaction => {
      let [addCount, removeCount] = isAdd ? [1, 0] : [0, 1];
      if (userReaction) {
        // console.log('userReaction', userReaction.addCount ? typeof(userReaction.addCount) : '_');
        addCount += parseInt(userReaction.addCount, 10);
        removeCount += parseInt(userReaction.removeCount, 10);
      }
      return userReaction
        ? userReaction.update({ addCount, removeCount })
        : UserReaction.create({ userId, reaction, addCount, removeCount });
    });
}

function getAllReactions() {
  return UserReaction.findAll({ raw: true });
}

var datastore = {
  set,
  get,
  connect,
  getAll,
  count,
  setUserAction,
  userReactionCount,
  getAllReactions,
};

module.exports = {
  data: datastore
};
