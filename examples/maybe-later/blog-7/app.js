var _ = require('underscore');
var express = require('express');
var view;
var passport = require('passport');
// Allows us to check whether an email address matches a simple pattern with * wildcards
var minimatch = require('minimatch');
var sanitize = require('validator').sanitize;

module.exports = {
  init: function(context, callback) {
    // Create an Express app object to add routes to and add
    // it to the context
    var app = context.app = express.createServer();

    // The express "body parser" gives us the parameters of a 
    // POST request is a convenient req.body object
    app.use(express.bodyParser());

    // Get the view module from the context
    view = context.view;

    // We need cookie parsing support for Passport
    context.app.use(express.cookieParser());

    // Bring in the connect-mongodb session handler
    var connectMongoDb = require('connect-mongodb');

    // Create our session storage
    var mongoStore = new connectMongoDb({ db: context.mongoConnection });

    // Our user sessions should be authenticated with a secret unique to this project
    context.app.use(express.session({ secret: context.settings.sessionSecret, store: mongoStore }));

    // Serve static files (such as CSS and js) in this folder
    app.use('/static', express.static(__dirname + '/static'));

    // We must install passport's middleware before we can set routes that depend on it,
    // but after our static file configuration so that login is not mandatory to see 
    // nice chrome on the login page
    configurePassport();

    // PUBLIC-FACING URLS

    // Deliver a list of posts when we see just '/'
    app.get('/', function(req, res) {
      context.db.posts.findAll(function(err, posts) {
        if (err)
        {
          notFound(res);
          return;
        }

        page(req, res, 'index', {posts: posts} );
      });
    });

    // Deliver a specific post when we see /posts/:slug
    app.get('/posts/:slug', function(req, res) {
      context.db.posts.findOneBySlug(req.params.slug, function(err, post) {
        if (err || (!post))
        {
          notFound(res);
          return;
        }
        page(req, res, 'post', {post: post, subview: false});
      });
    });

    // REST API
    app.get('/api/v1/posts', function(req, res) {
      context.db.posts.findAll(function(err, posts) {
        if (err)
        {
          notFound(res);
          return;
        }
        res.json(posts);
      });
    });

    app.post('/api/v1/posts', function(req, res) {
      if (!req.permissions.post)
      {
        res.status = 403;
        res.send("Forbidden");
        return;
      }
      var post = _.pick(req.body, 'title', 'body');
      // Make sure the post body doesn't contain XSS attacks
      // (cross-site scripting attacks)
      post.body = sanitize(post.body).xss().trim();
      context.db.posts.insert(post, function(err, post) {
        if (err)
        {
          // Probably a duplicate slug. 409 = "Conflict," a reasonable response
          res.status = 409;
          res.send("Conflict: Duplicate Slug");
          return;
        }
        else
        {
          res.json(post);
          return;
        }
      });
    });

    // Update a post when we see a PUT request for /posts/:id
    app.put('/api/v1/posts/:slug', function(req, res) {
      if (!req.permissions.post)
      {
        res.status = 403;
        res.send("Forbidden");
      }
      var post = _.pick(req.body, 'title', 'body');
      // Make sure the post body doesn't contain XSS attacks
      // (cross-site scripting attacks)
      post.body = sanitize(post.body).xss().trim();
      // We use $set to signify that we want to update certain fields.
      // Otherwise the slug and created fields, which are not editable,
      // would be lost altogether on update
      context.db.posts.update(req.params.slug, { $set: post }, function(err, post) {
        if (err)
        {
          res.status = 404;
          res.send("Not Found: No Such Slug");
        }
        else
        {
          res.json(post);
        }
      });
    });

    // Delete a post when we see a DELETE request for /posts/:id
    app.delete('/api/v1/posts/:slug', function(req, res) {
      if (!req.permissions.post)
      {
        res.status = 403;
        res.json({ 'error': 'Forbidden' });
      }
      context.db.posts.remove(req.params.slug, function(err) {
        if (err)
        {
          res.status = 404;
          res.json({ 'error': 'Not Found' });
        }
        else
        {
          res.status = 200;
          // Backbone is only happy with a JSON response
          res.json({ 'deleted': req.params.slug });
        }
      });
    });

    app.get('*', function(req, res) {
      notFound(res);
    });

    // The notFound function is factored out so we can call it
    // both from the catch-all, final route and if a URL looks
    // reasonable but doesn't match any actual posts

    function notFound(res)
    {
      res.send('<h1>Page not found.</h1>', 404);
    }

    // A convenient way to send a page as part of the response.
    // Wraps view.page without forcing Express-specific code
    // into that module
    function page(req, res, template, data)
    {
      // Displaying the user's name or email address is a common requirement.
      // Make sure data.slots.user exists - but do it without clobbering if
      // someone has explicitly provided data.slots or data.slots.user already.
      // Ditto for the session
      _.defaults(data, { slots: {} });
      _.defaults(data.slots, { user: req.user, session: req.session, permissions: req.permissions });
      res.send(view.page(template, data));
    }

    // We didn't have to delegate to anything time-consuming, so
    // just invoke our callback now
    callback();

    // Set up user authentication
    function configurePassport()
    {
      var GoogleStrategy = require('passport-google').Strategy;
      passport.use(new GoogleStrategy(
        context.settings.google,
        function(identifier, profile, done) {
          // Create a user object from the most useful bits of their profile.
          // With google their email address is their unique id. 
          var user = { 'email': profile.emails[0].value, 'displayName': profile.displayName };
          done(null, user);
        }
      ));

      // It's up to us to tell Passport how to store the current user in the session, and how to take
      // session data and get back a user object. We could store just an id in the session and go back
      // and forth to the complete user object via MySQL or MongoDB lookups, but since the user object
      // is small, we'll save a round trip to the database by storign the user
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


      app.use(passport.initialize());
      app.use(passport.session());

      // Set up middleware to populate req.permissions before
      // we start adding routes. Once we add a route it's too late
      // to add more middleware
      app.use(permissionsMiddleware);

      // Borrowed from http://passportjs.org/guide/google.html

      // Redirect the user to Google for authentication.  When complete, Google
      // will redirect the user back to the application at
      // /auth/twitter/callback

      app.get('/auth/google', passport.authenticate('google'));

      // Twitter will redirect the user to this URL after approval.  Finish the
      // authentication process by attempting to obtain an access token.  If
      // access was granted, the user will be logged in.  Otherwise,
      // authentication has failed.
      app.get('/auth/google/callback', 
        passport.authenticate('google', 
          { 
            successRedirect: '/',
            failureRedirect: '/' 
          }));

      app.get('/logout', function(req, res)
      {
        req.logOut();
        res.redirect('/');
      });
    }

    function permissionsMiddleware(req, res, next)
    {
      req.permissions = { post: false };

      if (req.user)
      {
        if (minimatch(req.user.email, context.settings.posters))
        {
          req.permissions.post = true;
        }
      }
      next();
    }

    function validPoster(req, res)
    {
      if (!req.user)
      {
        res.redirect('/auth/google');
        return false;
      }
      if (!req.permissions.post)
      {
        req.session.error = "Sorry, you do not have permission to post to this blog.";
        res.redirect('/');
        return false;
      }
      return true;
    }
  }
};

