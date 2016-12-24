# Slack Slash Command Response Handler

This project demonstrates responding to Slash commands in Slack, using MongoDB for persistence.

The app implements a simple counter, incrementing the counter each time the `/count` Slash Command is used. This app provides a basic template that you can [remix](https://gomix.com#!/remix/SlashCommands/a9e55c25-bf40-4162-b1b5-dc33047c0cdc) to create your own Slash Command handler.

![Screen Shot 2016-08-11 at 10.08.34](https://hyperdev.wpengine.com/wp-content/uploads/2016/08/Screen-Shot-2016-08-11-at-10.08.34.png)

## Getting Started
To get started you need to:
- Add a Slash Command configuration to your Slack integrations
- Copy the generated Command Token
- Add your database credentials along with the token to the `.env` file

For more detailed setup instructions, see `setup.md`.

2016/12/24 Robin
  Several updates
  1. More consistent use of ES2015 => fat arrow.
  2. Datastore / connect() was not returning on reject() so was running success code on error and throwing additional errors.
  3. Lots of code dupe in sync code in tinyspeck around sycn code. (not tested yet)
  4. Moved MONGODB_URI into index.js (should not be in datastore.js IMO) then added parameter to datastore connect(connectUri).
  5. Moved use of process.env.COLLECTION to index.js as parameter to datastore connect(connectUri, dbCollection)


