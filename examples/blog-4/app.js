var _ = require('underscore');
var express = require('express');
var view;

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

    // Serve static files (such as CSS and js) in this folder
    app.use('/static', express.static(__dirname + '/static'));

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
        res.send(view.page('post', {post: post}));
      });
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
      var post = _.pick(req.body, 'title', 'body');
      context.db.posts.insert(post, function(err, post) {
        if (err)
        {
          // Probably a duplicate slug, ask the user to try again
          // with a more distinctive title. We'll fix this
          // automatically in our next installment
          newPost(res, "Make sure your title is unique.");
        }
        else
        {
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
      res.send('<h1>Page not found.</h1>', 404);
    }

    // We didn't have to delegate to anything time-consuming, so
    // just invoke our callback now
    callback();
  }
};

