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
let connected = false;

//
// For each Slash Command that you want to handle, you need to add a new `slack.on()` handler function for it.
// This handler captures when that particular Slash Command has been used and the resulting HTTP request fired
// to your endpoint. You can then run whatever code you need to for your use-case. 
//
// The `slack` functions like `on()` and `send()` are provided by `tinyspeck.js`. 
//
// Watch for /count slash command
slack.on('/count', payload => {
  console.log("Received /count slash command from user " + payload.user_id, payload);
  /* payload example.
  team_id: 'T0259R09H',   team_domain: 'alertrobin',
  channel_id: 'C0259R09P',   channel_name: 'general',
  user_id: 'U0259R09K',   user_name: 'berg',
  command: '/count',   text: '',
  response_url: 'https://hooks.slack.com/commands/T0259R09H/120488173955/7k8DdqXnZ6WlG8JuvK0QDWAL'
  */
  
  const { user_id, user_name, response_url, channel_id } = payload;
  // slack.send(response_url, { channel: user_id, text: 'Burble...' }).catch(() => void 0);
  // slack.send(response_url, { 
  //   channel: user_id, 
  //   text: 'Test from /count slack command <bergle>.',
  //   response_type: 'in_channel' // make it visible to channel https://api.slack.com/slash-commands
  // }).catch(() => void 0);  // ignore send failures.

  datastore.connect(MONGODB_URI, process.env.COLLECTION)
    .then(
      data => {
        console.log('database.connect() success');
        datastore.get(user_id) // get the count for the user_id
          .then(count => {
            //throw new Error("Hello world");
            let message = getMessage(user_id, user_name, count);
            // send current count privately
            slack.send(response_url, message)
              .then(res => { // on success
                console.log("Response sent to /count slash command");
              }, reason => { // on failure
                console.log("An error occurred when responding to /count slash command: " + reason);
              });
          });
      }, 
      reason => { 
        console.log('database.connect() error.', reason) 
        slack.send(response_url,
          { channel: user_id, text: 'Error database connection failed.' }
        ).catch(() => void 0); // ignore send failures.
      }
    )
    .catch(reason => { console.log('some other error after success connect()', reason) } );
});
    
function getMessage(userRef, userName, count) {
  if (!count){ // no value stored for this user
    count=1;
    datastore.set(userRef, count).then(() => { // store initial count value for user
      console.log("Saved initial count ("+count+") for: " + userRef);
    });
  } else { // there was a value stored
    count++;
    datastore.set(userRef, count).then(() => { // store updated count value for user
      console.log("Saved updated count ("+count+") for: " + userRef);
    });
  }
  // return Object.assign({ channel: userRef, text: "Current count is: " + count });
  return { 
    channel: userRef, 
    text: `Current count for ${userName} is: ${count}`,
    response_type: 'in_channel'
  };
}

// incoming http requests
slack.listen('3000');