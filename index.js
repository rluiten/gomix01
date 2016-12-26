"use strict";

// Escaped \ in this logo.
const logoText = `
/     \\
vvvvvvv  /|__/|
   |   /O,O   |
   | /_____   |      /|/|
   |/^ ^ ^ \\  |    /00  |    _//|
   |^ ^ ^ ^ |W|   |/^^\\ |   /oo |  TEACH ME!
    \\m___m__|_|    \\m_m_|   \\mm_|`;

//console.log('logoText', logoText);

const ts = require('./tinyspeck.js')
const ds = require("./datastore.js");
const datastore = ds.async;
// Standard URI format: mongodb://[dbuser:dbpassword@]host:port/dbname, details set in .env
var MONGODB_URI = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;

const slack = ts.instance({ });
// let connected = false; // not used at moment.

//
// For each Slash Command that you want to handle, you need to add a new `slack.on()` handler function for it.
// This handler captures when that particular Slash Command has been used and the resulting HTTP request fired
// to your endpoint. You can then run whatever code you need to for your use-case. 
//
// The `slack` functions like `on()` and `send()` are provided by `tinyspeck.js`. 
//
// Watch for /count slash command
slack.on('/count', payload => {
  //console.log("Received /count slash command from user " + payload.user_id, payload);
  const { user_id, user_name, response_url, channel_id } = payload;

  // fire and forget send message.
  function sendAndLog(text, reason) {
    slack.send(response_url, { channel: user_id, text }).catch(() => void 0); 
    console.log(text, reason) 
  }

  datastore.connect(MONGODB_URI, process.env.COLLECTION)
    .then(
      data => {
        // console.log('database.connect() success');
        return datastore.get(user_id) // get the count for the user_id
      }, 
      reason => { 
        sendAndLog('Error database connection failed.', reason);
      }
    )
    .then(count => {
        const message = getMessage(user_id, user_name, count);
        // send current count privately
        slack.send(response_url, message)
          .then(data => { // on success
            console.log("Response sent to /count slash command");
          }, reason => { // on failure
            console.log("An error occurred when responding to /count slash command: " + reason);
          });
      }, reason => {
        sendAndLog('Error database get value.', reason);
      }
    )
    .catch(reason => { console.log('some other error after success connect()', reason) } );
});
    
function getMessage(userRef, userName, count) {
  count = count ? count + 1 : 1;
  datastore.set(userRef, count).then(() => {
    console.log(`Saved count ("${count}") for: ${userRef} (1 is initial count value if not previously set)`);
  });
  return { 
    channel: userRef, 
    text: `Current count for ${userName} is: ${count}`,
    response_type: 'in_channel'
  };
}

// incoming http requests
slack.listen('3000');
