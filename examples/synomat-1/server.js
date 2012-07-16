var _ = require('underscore');
var options = require('./options.js');
var ntwitter = require('ntwitter');
var fs = require('fs');

var tweeter = new ntwitter(options.twitter);

var me = options.twitter.username;

var thesaurus = loadThesaurus();
bot();

function loadThesaurus()
{
  console.log("Loading thesaurus...");
  var thesaurus = {};
  var lines = fs.readFileSync(__dirname + '/mthesaur.txt').toString().split("\n");
  _.each(lines, function(line) {
    var words = line.split(',');
    if (words.length)
    {
      var term = words[0];
      while (true)
      {
        var synonyms = words.join(', ');
        // 140 characters minus 15 character username minus
        // leading @ in reply minus space after username
        if (synonyms.length > (140 - 15 - 2))
        {
          words.pop();
          continue;
        }
        else
        {
          break;
        }
      }
      thesaurus[term] = synonyms;
    }
  });
  console.log("Thesaurus loaded.");
  return thesaurus;
}

function bot()
{
  tweeter.verifyCredentials(function (err, data) {
    if (err)
    {
      console.log("Credentials bad. Bummer. Go check that in dev.twitter.com.");
    }
    console.log("Verified credentials");
  })
  .stream('user', { track: options.twitter.username }, function(stream) {
    console.log("Listening to tweets");
    stream.on('data', function (data) {
      if (!data.user)
      {
        // Not a tweet. For example I've received a list of friend ids
        // here for some reason
        return;
      }
      var them = data.user.screen_name;
      if (data.in_reply_to_screen_name === me) {
        var result = data.text.match(/ (\w+)\s*$/);
        if (result)
        {
          var word = result[1].toLowerCase();
          if (_.has(thesaurus, word))
          {
            reply(thesaurus[word]);
          }
          else
          {
            reply("sorry, I don't know the word " + word + ".");
          }
        }
        else
        {
          reply("just tweet me one word and I will tweet back synonyms, analogues, equivalents.");
        }
      }
      function reply(msg)
      {
        tweeter.updateStatus("@" + them + " " + msg, function(err, data)
        {
          if (err)
          {
            console.log(err);
            // Not a big deal if a tweet fails. We could log something interesting though.
          }
        });
      }
    });
    stream.on('end', function (response) {
      // Handle a disconnection
      console.log('end event, listening again');
      setTimeout(1000, listen);
    });
    stream.on('destroy', function (response) {
      // Handle a 'silent' disconnection from Twitter, no end/error event fired
      console.log('destroy event, listening again');
      setTimeout(1000, listen);
    });
  });
}

