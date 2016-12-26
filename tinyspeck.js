//
// Adapted from https://github.com/johnagan/tinyspeck
// This is a lightweight adapter to interact with Slack's APIs and it validates that the requests
// received use the token you set in your .env file. We've extended it to add basic route
// handling for our URL root, so that we can serve up a page to anyone visiting. This can be removed
// or built upon depending on your needs.
//
"use strict";

const dispatcher = require('httpdispatcher');
const http = require('http');
const axios = require('axios');
const WebSocket = require('ws');
const qs = require('querystring');
const EventEmitter = require('events');

class TinySpeck extends EventEmitter {
  /**
   * Contructor
   *
   * @param {Object} defaults - The default config for the instance
   */
  constructor(defaults) {
    super();
    this.cache = {};

    // message defaults
    this.defaults = defaults || {};
    
    // loggers
    this.on('error', console.error);
  }

  /**
   * Create an instance of the TinySpeck adapter
   *
   * @param {Object} defaults - The default config for the instance
   * @return {TinySpeck} A new instance of the TinySpeck adapter
   */
  instance(defaults) {
    return new this.constructor(defaults);
  }

  /**
   * Send data to Slack's API
   *
   * @param {string} endPoint - The method name or url (optional - defaults to chat.postMessage)
   * @param {object} args - The JSON payload to send
   * @return {Promise} A promise with the API result
   */
  send(/* ...args */) {
    let args = 1 <= arguments.length ? Array.prototype.slice.call(arguments, 0) : [];
    
    let endPoint = 'chat.postMessage'; // default action is post message
    
    // if an endpoint was passed in, use it
    if (typeof args[0] === 'string') endPoint = args.shift();

    // use defaults when available
    // note: using assign() to copy arg0 to index [0] to use with post is to tricky. Robin.
    let message = Object.assign({}, this.defaults, args);
    
    // note: there is no way to get a timestamp unless it its set in defaults..
    // which is very odd way to set timestamp.. USED by rtm more than anything else it seems.
    
    // call update if ts included
    if (message.ts) endPoint = 'chat.update';
    
    return this.post(endPoint, message);
  }

  /**
   * Parse a Slack message
   *
   * @param {object|string} message - The incoming Slack message
   * @return {Message} The parsed message
   */
  parse(message) {
    if (typeof message === 'string') {
      try { message = JSON.parse(message); }      // JSON string
      catch(e) { message = qs.parse(message); }   // QueryString
    }
    
    // message button payloads are JSON strings
    if (message.payload) message.payload = JSON.parse(message.payload);
    
    return message;
  }

  /**
   * Digest a Slack message and process events
   *
   * @param {object|string} message - The incoming Slack message
   * @return {Message} The parsed message
   */
  digest(message) {
    // let event_ts = this.parse(message).event_ts;
    // let event = this.parse(message).event;
    // let command = this.parse(message).command;
    // let type = this.parse(message).type;
    // let trigger_word = this.parse(message).trigger_word;
    // let payload = this.parse(message).payload;
    const { event_ts, event, command, type, trigger_word, payload }
      = this.parse(message);
      
    // NOTE: bit concerned that emits of all these different fields
    // overlap in namespace, so emit of type "important" can only be
    // separated from command "important" by examining the message.
    //
    // IDEA: prefix emits with field name. `type:${type}`
    
    // wildcard
    this.emit('*', message);

    // notify incoming message by type
    if (type) this.emit(type, message);

    // notify slash command by command
    if (command) this.emit(command, message);

    // notify event triggered by event type
    if (event) this.emit(event.type, message);

    // notify webhook triggered by trigger word
    if (trigger_word) this.emit(trigger_word, message);

    // notify message button triggered by callback_id
    if (payload) this.emit(payload.callback_id, message);

    return message;
  }

  /**
   * Event handler for incoming messages
   *
   * @param {mixed} names - Any number of event names to listen to. The last will be the callback
   * @return {TinySpeck} The TinySpeck adapter
   */
  on(/* ...names */) {
    let names = 1 <= arguments.length ? Array.prototype.slice.call(arguments, 0) : [];
    let callback = names.pop(); // support multiple events per callback
    names.forEach(name => super.on(name, callback));

    return this; // chaining support
  }

  /**
   * Start RTM
   *
   * @param {object} options - Optional arguments to pass to the rtm.start method
   * @return {WebSocket} A promise containing the WebSocket
   */
  rtm(options) {
    return this.send('rtm.start', options).then(res => {
      this.cache = res.data.self;
      let ws = new WebSocket(res.data.url);
      ws.on('message', this.digest.bind(this));
      ws.on('close', () => this.ws = null);
      ws.on('open', () => this.ws = ws);
      return Promise.resolve(ws);
    });
  }

 /**
   * WebServer to listen for WebHooks
   *
   * @param {int} port - The port number to listen on
   * @param {string} token - Optionally provide a token to verify
   * @return {listener} The HTTP listener
   */
  listen(port, token) {

    // Display the Add to Slack button
    dispatcher.onGet("/", function(req, res) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      const html = '<h2>ButterCat. Example Slack Slash Command Handler</h2>'
      + '<br /><a id="add-to-slack" href="https://slack.com/apps/A0F82E8CA-slash-commands">' 
      + '<img alt="Add to Slack" height="40" width="139"' 
        + ' src="https://platform.slack-edge.com/img/add_to_slack.png"' 
        + ' srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x,' 
        + ' https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a><br><br><br><hr>' 
      + '<p><a href="https://gomix.com/#!/remix/slash-command/a9e55c25-bf40-4162-b1b5-dc33047c0cdc">' 
      + '<img src="https://gomix.com/images/background-light/remix-on-gomix.svg"></a></p>' 
      + '<p><a href="https://gomix.com/#!/project/slash-command">View Code</a></p>';
      res.end(html);
    });     
    
    return http.createServer((req, res) => {
      let data = '';
      
      req.on('data', chunk => data += chunk);
      
      req.on('end', () => {
        const message = this.parse(data);

        // notify upon request
        this.emit(req.url, message); 
        
        // digest the incoming message
        if(!message.token){
          console.log("No token received");
        }
        else if (process.env.SLACK_TOKEN === message.token){
          console.log('listen, slack token matches, do call digest()');
          // Token matches - proceeding to process message
          this.digest(message);
        } else {
          console.log("Token received didn't match that in .env");
        }
        
        // close response
        res.end();
      });

      dispatcher.dispatch(req, res);

    }).listen(port, '0.0.0.0', () => {
      console.log(`listening for events on port ${port}`);
    });
  }

  /**
   * POST data to Slack's API
   *
   * @param {string} endPoint - The method name or url
   * @param {object} payload - The JSON payload to send
   * @return {Promise} A promise with the api result
   */
  post(endPoint, payload) {
    return axios({ // responding to slash command
      url: endPoint,
      data: payload[0],
      method: 'post', 
      headers: { 'user-agent': 'TinySpeck' }
    });
  }
}

module.exports = new TinySpeck();
