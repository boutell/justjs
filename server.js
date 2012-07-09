var _ = require('underscore');

var options = { 
  db: {
    host: '127.0.0.1',
    port: 27017,
    name: 'justjs'
  },
  http: {
    port: 3000
  },
  templates: {},
  // In production you should override this in config-local.js
  sessionSecret: 'CHANGEME',
  // Your UA-XXXXX tracking code, if you have one
  googleAnalytics: false,
  url: 'http://justjs.com',
  description: 'justjs: an autobiographical blog of full-stack javascript web app development'
};

try
{
  // In staging and production get the port number from stagecoach
  // http://github.com/punkave/stagecoach
  options.http.port = fs.readFileSync(__dirname + '/data/port', 'UTF-8').replace(/\s+$/, '');
} catch (err)
{
  // This is handy in a dev environment
  console.log("I see no data/port file, defaulting to port " + options.http.port);
}

// Let settings specific to this server override global settings
// Use a local relative path (./) to require a file here in this project
// rather than one in NPM
_.extend(options, require('./data/config-local.js'));

var fs = require('fs');
var mongo = require('mongodb');
var async = require('async');
var express = require('express');
var passport = require('passport');
var app = express.createServer();
var sanitize = require('validator').sanitize;
var RSS = require('rss');

app.use(canonicalizeHost);

// Use the body parser express middleware to automatically parse
// POST form submissions
app.use(express.bodyParser());
// Make cookies available for sessions, which Passport requires to give us logins
app.use(express.cookieParser());
app.use(express.session({ secret: options.sessionSecret }));
// Now we can configure passport
configurePassport();

// Serve static files (such as CSS and js) in this folder
app.use('/static', express.static(__dirname + '/static'));

// Underscore templates to render various pages
options.templates.post = _.template(fs.readFileSync(__dirname + '/templates/post._', 'utf8'));
options.templates.postBody = _.template(fs.readFileSync(__dirname + '/templates/postBody._', 'utf8'));
options.templates.layout = _.template(fs.readFileSync(__dirname + '/templates/layout._', 'utf8'));

var db;
var postCollection;

async.series([connect, listen], ready);

function connect(callback)
{
  db = new mongo.Db(options.db.name, new mongo.Server(options.db.host, options.db.port, {}), {});
  db.open(function(err, client) {
    postCollection = db.collection('post');
    postCollection.ensureIndex("slug", { unique: true }, function(err, indexName) 
    {
      console.log('Database initialized');
      callback(err);
    });
    // Enhance postCollection with our insertUniquely method
    postCollection.insertUniquely = insertUniquely;
  });
}

function listen(callback)
{
  app.listen(options.http.port);  
  console.log("Listening on port " + options.http.port);
  callback(null);
};

function ready(err, results)
{
  if (err)
  {
    console.log("Uh-oh:");
    console.log(err);
  }
  else
  {
    console.log("Ready");
  }
}

app.get('/', function(req, res) {
  postCollection.find().sort({created: (req.session.first ? 1 : -1)}).toArray(function(err, posts) {
    if (err)
    {
      throw err;
    }

    // 100 word limit on each summary, HTML removed. TODO: this should be offered to the validator module,
    // or maybe as an ejs filter
    _.each(posts, function(post) {
      // Strip HTML tags
      var text = post.body.replace(/<(?:.|\n)*?>/gm, '');
      // Split into words
      var words = text.split(/\s+/);
      // Slice off first 200 words
      summaryWords = words.slice(0, 200);
      post.body = summaryWords.join(' ');
      // Add ellipsis if we cut it short
      if (words.length !== summaryWords.length)
      {
        post.body += '&hellip;';
      }
    });

    // Use permissions to determine whether to show the 'post' button
    sendPage(req, res, 'index', { posts: posts, 'permissions': getPermissions(req) });
  });
});

app.get('/feed.rss', function(req, res) {
  postCollection.find().sort({created: -1}).toArray(function(err, posts) {
    if (err)
    {
      throw err;
    }
    // Create an RSS feed using Dylan Greene's nifty rss npm module
    var feed = new RSS({
      title: 'justjs',
      description: options.description,
      feed_url: options.url + '/feed.rss',
      site_url: options.url,
      author: options.author,
    });

    _.each(posts, function(post) {
      feed.item({
        title: post.title,
        description: post.body + "<h4><a href=\"" + options.url + "/posts/" + post.slug + "#disqus_thread\">Comment on this post</a></h4>",
        url: options.url + '/posts/' + post.slug,
        guid: post.slug,
        author: options.author,
        date: post.date
      });
    });

    var xml = feed.xml();

    res.contentType('application/rss+xml');
    res.send(xml);
  });
});

app.get('/posts/:slug', function(req, res) {
  var slug = req.params.slug;
  postCollection.findOne({slug: slug}, function(err, post) { 
    if (err)
    {
      throw err;
    }
    if (post)
    {
      sendPage(req, res, 'post', { post: post });
    }
    else
    {
      res.status(404);
      res.send('Post Not Found');
    }
  });
});

app.get('/posts/:slug/edit', function(req, res) {
  var slug = req.params.slug;
  postCollection.findOne({slug: slug}, function(err, post) { 
    if (err)
    {
      throw err;
    }
    if (post)
    {
      sendPage(req, res, 'edit', { post: post });
    }
    else
    {
      res.status(404);
      res.send('Post Not Found');
    }
  });
});

app.post('/posts/:slug/edit', function(req, res) {
  permissions = getPermissions(req);
  if (!permissions.post)
  {
    res.status(403);
    res.send('You do not have posting privileges');
    return;
  }
  var slug = req.params.slug;
  postCollection.findOne({slug: slug}, function(err, post) { 
    if (err)
    {
      throw err;
    }
    if (post)
    {
      post.title = req.body.title;
      post.body = sanitize(req.body.body).xss();

      postCollection.update({slug: slug}, post, {safe: true}, function(err, docs) {
        res.redirect('/');
      });
    }
    else
    {
      res.status(404);
      res.send('Post Not Found');
    }
  });
});

// TODO: using the GET method for verbs is really pretty terrible
app.get('/posts/:slug/delete', function(req, res) {
  permissions = getPermissions(req);
  if (!permissions.post)
  {
    res.status(403);
    res.send('You do not have posting privileges');
    return;
  }
  var slug = req.params.slug;
  postCollection.remove({slug: slug}, {safe: true}, function(err, count) { 
    if (err)
    {
      throw err;
    }
    if (!count)
    {
      res.redirect(404);
      res.send("Post Not Found");
    }
    res.redirect('/');
  });
});

app.get('/last', function(req, res) {
  req.session.first = false;
  res.redirect('/');
});

app.get('/first', function(req, res) {
  req.session.first = true;
  res.redirect('/');
});

app.get('/new', function(req, res) {
  sendPage(req, res, 'new', {});
});

app.post('/new', function(req, res) {
  permissions = getPermissions(req);
  if (!permissions.post)
  {
    res.status(403);
    res.send('You do not have posting privileges');
    return;
  }
  var post = _.pick(
    _.defaults(req.body, {'title': '', 'body': ''}), 
    'title', 'body');
  post.slug = slugify(post.title);
 
  // We allow HTML in the body (via the rich text editor), but we don't want 
  // XSS attacks (user-submitted scripts in the body)
  post.body = sanitize(post.body).xss();
 
  post.created = new Date();
 
  // If there are unique index errors keep adding random digits via
  // insertUniquely until we have a unique slug. On success redirect to the
  // index page, where we can see the new post at the top
  postCollection.insertUniquely(post, {}, function(err, docs) {
    res.redirect('/');
  });
});

// Render a page template nested in the layout, allowing slots 
// (such as overrides of the page title) to be passed back to the layout 
function sendPage(req, res, template, data)
{
  // It's useful to be able to access the user and session objects
  var slots = { 'user': req.user, 'session': req.session, 'options': options };
  _.defaults(data, { slots: slots });
  slots.body = renderPartial(req, template, data);
  res.send(renderPartial(req, 'layout', { slots: slots }));
}

function renderPartial(req, template, data)
{
  // Avoid the use of _.defaults when computing the value is expensive;
  // test and make sure it's necessary

  // Make user permissions available to partials
  if (_.isUndefined(data.permissions))
  {
    data.permissions = getPermissions(req);
  }

  // Compile the template if we haven't already
  if (_.isUndefined(options.templates[template]))
  {
    options.templates[template] = _.template(fs.readFileSync(__dirname + '/templates/' + template + '._', 'utf8'));
  }

  // Inject a partial() function for rendering another partial inside this one
  if (_.isUndefined(data.partial))
  {
    data.partial = function(partial, partialData) {
      _.defaults(partialData, { slots: data.slots });
      return renderPartial(req, partial, partialData);
    };
  }

  // Inject the options so we can call whatever we need;
  // create a slot context if we don't have one already from
  // the call we're nested in
  _.defaults(data, { options: options, slots: {} }); 

  // Render the template
  return options.templates[template](data);
}

// Is the user associated with the current request allowed to carry out
// the specified action? Creating a separate function for this allows us
// to easily swap it out for a more sophisticated check of privileges
// associated with the user in a database at any time. For now just check
// the admin user name in options

function getPermissions(req)
{
  return {
    post: (req.user && (req.user.username === options.admin))
  }
}

// Create a reasonable slug for use in URLs based on the supplied string
function slugify(s)
{
  // Note: you'll need to use xregexp instead if you need non-Latin character
  // support in slugs

  // Everything not a letter or number becomes a dash
  s = s.replace(/[^A-Za-z0-9]/g, '-');
  // Consecutive dashes become one dash
  s = s.replace(/\-+/g, '-');
  // Leading dashes go away
  s = s.replace(/^\-/, '');
  // Trailing dashes go away
  s = s.replace(/\-$/, '');
  // If the string is empty, supply something so that routes still match
  if (!s.length)
  {
    s = 'none';
  }
  return s.toLowerCase();
}

// Use like this:

// mycollection.insertUniquely = insertUniquely;
// mycollection.insertUniquely(doc, {}, callback);

// You can specify additional options besides 'safe' with the
// second parameter. 'safe' is forced on to detect unique slug errors.

// If there is a conflict with another document that has the same slug, a 
// more unique slug will automatically be generated, in a concurrency-safe way

function insertUniquely(doc, options, callback)
{
  var self = this;
  options.safe = true;
  insertUniquelyBody(doc, options, callback);
  function insertUniquelyBody(doc, options, callback)
  {
    self.insert(doc, options, function(err, docs) {
      if (err)
      {
        // 11000 is the MongoDB error code for attempting to
        // insert two posts with the same slug (a unique 
        // index error). When this happens, add a random
        // digit to the slug and try again until it is unique
        if ((err.code === 11000) && (err.err.indexOf('slug') !== -1))
        {
          doc.slug += (Math.floor(Math.random() * 10)).toString();
          insertUniquelyBody(doc, options, callback);
          return;
        }
      }
      else
      {
        callback(err, docs);
      }
    });
  }
}

function configurePassport()
{
  var TwitterStrategy = require('passport-twitter').Strategy;
  passport.use(new TwitterStrategy(
    options.twitter,
    function(token, tokenSecret, profile, done) {
      // We now have a unique id, username and full name (display name) for the user 
      // courtesy of Twitter. I call the display name 'fullName' for consistency with
      // other situations in which I use a local database of users
      var user = { 'id': profile.id, 'username': profile.username, 'fullName': profile.displayName };
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

  // We must install passport's middleware before we can set routes that depend on it
  app.use(passport.initialize());
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
                                       failureRedirect: '/login' }));

  app.get('/logout', function(req, res)
  {
    req.logOut();
    res.redirect('/');
  });
  console.log("Installed passport.initialize");
}

// Canonicalization is good for SEO and prevents user confusion
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
