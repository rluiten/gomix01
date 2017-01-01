//
// This implements most of the bot code. It starts off by looking for the `bot_token` value that will
// have been stored if you successfully OAuthed with your Bot using the 'Add to Slack' button. Assuming
// it exists, it implements an instance of `slack`, and then listens out for incoming HTTP requests.
// It also implements code that watches for slash commands, sets up event handling for when events
// like `pin_added`, `star_added` or `reaction_added` are received. As well as using the database
// to record when actions like adding a star have been completed.
//
"use strict";

// two different counts. 
// 1. the emoji someone gives.
// 2. the emoji someone gets. leaderboard ? 

const ts = require('./tinyspeck.js');
const onboarding = require('./onboarding.json');
const users = {}; // cached onboarding message for each user last sent to user.
const datastore = require("./datastore.js").data;

var connected = false;

// const fs = require('fs');
// const filename2 = '/etc/app-types/node/start.sh';
// fs.readFile(filename2, 'utf8', function(err, data) {
//   if (err) throw err;
//   console.log('OK: ' + filename2);
//   console.log(data)
// });


function promisedProperties(object) {
  let promisedProperties = [];
  const objectKeys = Object.keys(object);

  objectKeys.forEach((key) => promisedProperties.push(object[key]));

  return Promise.all(promisedProperties)
    .then((resolvedValues) => {
      return resolvedValues.reduce((resolvedObject, property, index) => {
        resolvedObject[objectKeys[index]] = property;
        return resolvedObject;
      }, {});
    });
}


// build the user's current onboarding message
function getStatusMessage(user) {
  return Object.assign({ channel: user }, onboarding.welcome, users[user]);
}

getConnected() // Check we have a database connection
  .then(() => promisedProperties({ 
    tokenCount: datastore.count(),
    userReactionCount: datastore.userReactionCount(),
    reactions: datastore.getAllReactions(),
  }))
  .then(({tokenCount, userReactionCount, reactions}) => {
    console.log('tokenCount', tokenCount);
    console.log('userReactionCount', userReactionCount);
    console.log('reactions', reactions);
  })
  // .then(() => datastore.getAll())
  // .then(allValues => console.log('allValues', allValues))
  .then(function () {
    datastore.get("bot_token") // Grab the bot token before proceeding
      .then(function (value) {
        var slack;
        
        function send(m) {
          slack.send(m).catch(data => console.log('send ok.'), reason => console.log('send error.', reason));
        }
        
        if (!value) {
          console.log("There's no bot token stored - you need to auth this bot with Slack for it to be fully functional"); 
          // we need to be able to respond to verify requests from Slack before we
          // have a bot token set, so not setting one
          slack = ts.instance({});
        } else {
          console.log("Using bot token", value); 
          // we have the bot_token set, so we're good to go
          slack = ts.instance({ token:value });
        }

        // watch for onboarding slash commands
        slack.on(process.env.COMMAND_ONBOARD, payload => {
          const { user_id , response_url } = payload;
          console.log("Received slash command from user " + user_id);
          let message = getStatusMessage(user_id);
          
          // send current onboarding status privately
          slack.send(response_url, message).then(res => { // on success
            console.log("Response sent to slash command");
          }, reason => { // on failure
            console.log("An error occurred when responding to slash command: " + reason);
          }); 
        });

        slack.on('reaction_added', 'reaction_removed', payload => {
          // the user on the event: is the user receiving reaction.
          const { event: { type, user, item, reaction, item_user } } = payload;
          console.log(`Received 1: ${type} on ${item_user} from user ${user}. ${JSON.stringify(item)}`);//, payload);
          datastore.setUserAction(item_user, reaction, type === 'reaction_added'); // capture target user stats.
          // TODO capture creating user stats ?
          const text = type === 'reaction_added'
            ? `I saw that emoji. :${reaction}: on <@${item_user}> by <@${user}>`
            : `Aww bye bye emoji. :${reaction}: on <@${item_user}> by <@${user}>`
          const msg = { 
            channel: item.channel, 
            response_type: 'in_channel',
            text,
            // attachments: [{
            //   "event": "star_added",
            //   "title": "Star a Message",
            //   "title_link": "https://get.slack.help/hc/en-us/articles/201331016-Using-stars",
            //   "text": "Stars are a way to mark an item in Slack as important. You can star channels or direct messages to move them to the top of your left sidebar, or star messages so you can easily come back to them later."
            // }],
          };
          send(msg);
        });
        
        // event handler 
        slack.on('star_added', 'pin_added', 'reaction_added', 'reaction_removed', payload => {  
          const { event: { type, user, item, reaction } } = payload;
          console.log(`Received 0: ${type} from user ${user}. ${JSON.stringify(item)}`);//, payload);
          
          // if (type === 'reaction_added') {
          //   const msg = { 
          //     channel: item.channel, 
          //     response_type: 'in_channel',
          //     text: `I saw that emoji. :${reaction}:`,
          //     // attachments: [{
          //     //   "event": "star_added",
          //     //   "title": "Star a Message",
          //     //   "title_link": "https://get.slack.help/hc/en-us/articles/201331016-Using-stars",
          //     //   "text": "Stars are a way to mark an item in Slack as important. You can star channels or direct messages to move them to the top of your left sidebar, or star messages so you can easily come back to them later."
          //     // }],
          //   };
          //   send(msg);
            
          //   // datastore.setUserAction(user, reaction, true);
          // }
          
          let counter = -1;
          
          // get the user's current onboarding message
          let message = getStatusMessage(user);
          
          if (isJSON(message.attachments)) { // TODO fix only decode once. // THIS IS WEIRD....
            message.attachments = JSON.parse(message.attachments);
          }
        
          // modify completed step
          modifySteps(slack, type, user, item, reaction, counter, message);
        });
        
        // incoming http requests
        slack.listen('3000');
    })
    .catch(reason => { console.log('core index.js catch', reason)});
});

function getConnected() {
  return (connected = connected || datastore.connect());
}

function isJSON(data) {
  var ret = true;
  try {
    JSON.parse(data);
  } catch(e) {
    ret = false;
  }
  return ret;
}

function markStepAsDone(step) {
  step.title += ' :white_check_mark:';
  step.color = '#2ab27b';
  step.completed = true;
}

function modifySteps(slack, type, user, item, reaction, counter, message) {
  //console.log('modifySteps', user, type, item, counter);//, message);
  counter++;
  let step = message.attachments[counter];

  if (counter === message.attachments.length) { // got all values back, can move on
    console.log("Got all data back, sending response");
    // // save the message and update the timestamp
    // slack.send(message).then(res => { // on success
    //   console.log("Response sent to event");
    //   let ts = res.data.ts;
    //   let channel = res.data.channel;
    //   users[user] = Object.assign({}, message, { ts: ts, channel: channel });
    // }, reason => { // on failure
    //   console.log("An error occurred when responding to event: " + reason);              
    // }); 
  } else if (counter < message.attachments.length) {
    let storedStep;
    // sets a user-specific reference used to refer to data in the db.
    let valueRef = user + step.event; 
    datastore.get(valueRef)
      .then(function (value) {
        storedStep = value;
        if (storedStep) {
          markStepAsDone(step);
        } else {
            if (step.event === type) {
              markStepAsDone(step);
              datastore.set(valueRef, true).then(function () { // store that the step has been completed in the db
                console.log("Saved true for: " + valueRef);
                // if (type === 'reaction_added')
                //   /.datastore.setUserAction(user, reaction, true );
                // if (type === 'reaction_removed')
                //   .datastore.setUserAction(user, reaction, false );
              });
            }
          }
          // recursively call self until all responses back
          modifySteps(slack, type, user, item, reaction, counter, message);
        }); 
    }
  }