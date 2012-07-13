// You need to copy options-example.js to options.js and edit it
var options = require('./data/options.js');
var express = require('express');
var request = require('request');
var _ = require('underscore');
var passport = require('passport');
var fs = require('fs');
var mongoose = require('mongoose');

var app = express.createServer();
app.use(canonicalizeHost);
// Serve static files (such as CSS and js) in this folder
app.use('/static', express.static(__dirname + '/static'));
app.use(express.bodyParser());
configurePassport(app);

mongoose.connect(options.db.url);
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

var MoodSchema = new Schema({
  username    : { type: String, index: true },
  twitterId   : { type: String, index: true },
  name        : String,
  youtubeId   : String,
  thumbnail   : String,
  date        : { type: Date, index: true },
  width       : Number,
  height      : Number
});

var Mood = mongoose.model('Mood', MoodSchema);

// The homepage is really just a static HTML file with plenty of JavaScript that
// talks back to the app. Cache the contents so we only read the file once per run.

var homeTemplate;

app.get('/', function(req, res) {
  if (!homeTemplate)
  {
    homeTemplate = fs.readFileSync(__dirname + '/templates/app.html', 'utf8');
  }
  res.contentType('text/html');
  res.send(homeTemplate.replace('%USER%', JSON.stringify((req.user ? req.user : null) )));
});

app.post('/mood', function(req, res) {
  var name = req.body.mood;
  if (name === undefined)
  {
    res.status = 403;
    return;
  }
  if (!req.user)
  {
    res.status = 403;
    return;
  }
  var params = { 
      url: 'http://gdata.youtube.com/feeds/api/videos', 
      qs: { q: name, alt: 'json', format: 5 } 
    };
	request(params, function (error, response, body) {
    if (error || (response.statusCode !== 200)) {
      res.status = 500;
      return;
    }
    var data = JSON.parse(body);
    if (!data.feed.entry)
    {
      // Probably hitting the server too often
      res.status = 500;
      return;
    }
    var entries = data.feed.entry;
    var count = data.feed.entry.length;
    var i = Math.floor(Math.random() * count);
    var match = /[a-zA-Z0-9_-]+$/.exec(entries[i].id.$t);
    if (!match)
    {
      res.status = 500;
      return;
    }
    var id = match[0];
    var thumbnail = entries[i].media$group.media$thumbnail[0];
    var mood = new Mood(
      { 
        'username': req.user.username, 
        'twitterId': req.user.id, 
        'name': name, 
        'date': new Date(), 
        'youtubeId': id, 
        'thumbnail': thumbnail.url, 
        'width': thumbnail.width, 
        'height': thumbnail.height
      });
    mood.save(function(err, doc) {
      if (err)
      {
        res.status = 500;
        return;
      }
      res.status = 200;
      res.send(JSON.stringify(mood));
    });
  });
});

app.get('/feed', function(req, res) {
  var criteria = {};
  if (req.query.since !== undefined)
  {
    criteria.date = { $gt: req.query.since };
  }
  if (req.query.before !== undefined)
  {
    criteria.date = { $lt: req.query.before };
  }
  Mood.find(criteria).sort('date', -1).limit(12).exec(function(err, docs) {
    if (err)
    {
      res.status = 500;
      return;
    }
    res.send(JSON.stringify(docs));
  });
});

var port = 3000;
try
{
  // In production get the port number from stagecoach
  // http://github.com/punkave/stagecoach
  port = fs.readFileSync(__dirname + '/data/port', 'UTF-8').replace(/\s+$/, '');
} catch (err)
{
  // This is handy in a dev environment
  console.log("I see no data/port file, defaulting to port " + port);
}
console.log("Listening on port " + port);
app.listen(port);

function configurePassport(app)
{
  var TwitterStrategy = require('passport-twitter').Strategy;
  passport.use(new TwitterStrategy(
    options.twitter,
    function(token, tokenSecret, profile, done) {
      // We now have a unique id, username and full name (display name) for the user 
      // courtesy of Twitter.
      var user = { 'id': profile.id, 'username': profile.username, 'displayName': profile.displayName };
      done(null, user);
    }
  ));

  // It's up to us to tell Passport how to store the current user in the session, and how to take
  // session data and get back a user object. We could store just an id in the session and go back
  // and forth to the complete user object via MySQL or MongoDB lookups, but since the user object
  // is small and changes rarely, we'll save a round trip to the database by storing the user
  // information directly in the session in JSON string format.

  passport.serializeUser(function(user, done) {
    done(null, JSON.stringify(user));
  });

  passport.deserializeUser(function(json, done) {
    var user = JSON.parse(json);
    if (user)
    {
      done(null, user);
    }
    else
    {
      done(new Error("Bad JSON string in session"), null);
    }
  });

  app.use(express.cookieParser());
  // Express sessions let us remember the mood the user wanted while they are off logging in on twitter.com
  app.use(express.session({ secret: options.sessionSecret }));  
  // We must install passport's middleware before we can set routes that depend on it
  app.use(passport.initialize());
  // Passport sessions remember that the user is logged in
  app.use(passport.session());

  // Borrowed from http://passportjs.org/guide/twitter.html

  // Redirect the user to Twitter for authentication.  When complete, Twitter
  // will redirect the user back to the application at
  // /auth/twitter/callback
  app.get('/auth/twitter', passport.authenticate('twitter'));

  // Twitter will redirect the user to this URL after approval.  Finish the
  // authentication process by attempting to obtain an access token.  If
  // access was granted, the user will be logged in.  Otherwise,
  // authentication has failed.
  app.get('/auth/twitter/callback',
    passport.authenticate('twitter', { successRedirect: '/',
                                       failureRedirect: '/' }));

  app.get('/logout', function(req, res)
  {
    req.logOut();
    res.redirect('/');
  });
}

// Canonicalization is good for SEO and prevents user confusion,
// Twitter auth problems in dev, etc.
function canonicalizeHost(req, res, next)
{
  if (req.headers.host !== options.host)
  {
    res.redirect('http://' + options.host + req.url, 301);
  }
  else
  {
    next();
  }
}

