var _ = require('underscore');
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var minimatch = require('minimatch');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var view;


  
module.exports = {
  init: function(context, callback) {
    // Create an Express app object to add routes to and add
    // it to the context
    var app = context.app =  require("express")(); 
    // The express "body parser" gives us the parameters of a 
    // POST request is a convenient req.body object
    
    
    //app.use(bodyParser.urlencoded());
    app.use(bodyParser.json());    
    app.use(bodyParser.urlencoded({
      extended: true
    }));



    // Get the view module from the context
    view = context.view;

    // We need cookie parsing support for Passport
    context.app.use(cookieParser());

    // Bring in the connect-mongodb session handler
    var connectMongoDb = require('connect-mongodb');

    // Create our session storage
    var mongoStore = new connectMongoDb({ db: context.mongoConnection });

    
    // Our user sessions should be authenticated with a secret unique to this project
    context.app.use(session({ secret: context.settings.sessionSecret, store: mongoStore, resave: true, saveUninitialized: true }));

    // Serve static files (such as CSS and js) in this folder
    app.use('/static', express.static(__dirname + '/static'));

    // We must install passport's middleware before we can set routes that depend on it,
    // but after our static file configuration so that login is not mandatory to see 
    // nice chrome on the login page
    configurePassport();


    // Deliver a list of posts when we see just '/'
    app.get('/', function(req, res) {
      context.db.posts.findAll(function(err, posts) {
        if (err)
        {
          notFound(res);
          return;
        }
          res.send(view.page('index', {posts: posts}));
   
      });
    });

    // Deliver a specific post when we see /posts/ 
    app.get('/posts/:slug', function(req, res) {
      context.db.posts.findOneBySlug(req.params.slug, function(err, post) {
        if (err || (!post))
        {
          notFound(res);
          return;
        }
        res.send(view.page('post', {post: post}));      });
    });

    // Deliver a "new post" form when we see /new.
    // POST it right back to the same URL; the next route
    // below will answer 
    app.get('/new', function(req, res) {
      newPost(res);
    });

    // Save a new post when we see a POST request
    // for /new (note this is enough to distinguish it
    // from the route above)
    app.post('/new', function(req, res) {

      //var post = _.pick(req.body, 'title', 'body');
      var post_title = req.body;

      console.log(post);
      var post = _.pick(req.body, 'title', 'body');
      context.db.posts.insert(post, function(err, post) {
        //console.log("error");
        //console.log(post);
        if (err)
        {
          // Probably a duplicate slug, ask the user to try again
          // with a more distinctive title. We'll fix this
          // automatically in our next installment
          newPost(res, "Make sure your title is unique.");
        }
        else
        {

          //res.redirect('/posts/' + post.slug);
          res.redirect('/posts/' + post.slug);
        }
      });
    });

    // Send the "new post" page, with an error message if needed
    function newPost(res, message)
    {
      res.send(view.page('new', { 'message': message }));
      
    }

    app.get('*', function(req, res) {
      notFound(res);
    });

    // The notFound function is factored out so we can call it
    // both from the catch-all, final route and if a URL looks
    // reasonable but doesn't match any actual posts

    function notFound(res)
    {
      
      res.status(404).send('<h1>Page not found.</h1>');
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

    function validPoster(req, res)
    {
      if (!req.user)
      {
        res.redirect('/auth/google');
        return false;
      }
      if (!minimatch(req.user.email, context.settings.posters))
      {
        req.session.error = "Sorry, you do not have permission to post to this blog.";
        res.redirect('/');
        return false;
      }
      return true;
    }

  }
};
