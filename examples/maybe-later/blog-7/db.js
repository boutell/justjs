// We'll be using MongoDB
var mongo = require('mongodb');
var _ = require('underscore');

// These variables are local to this module
var db;
var postCollection;
var context;
var settings;
var cache = {};

module.exports = db = {
  // Initialize the module. Invokes callback when ready (or on error)
  init: function(contextArg, callback) {
    context = contextArg;
    settings = context.settings;

    // Open the database connection
    var dbConnection = new mongo.Db(
      settings.db.name, 
      new mongo.Server(settings.db.host, settings.db.port, {}), 
      {});

    // Store it in the context for use by other mongodb-powered code outside
    // the model layer of our app, such as the connect-mongodb session storage handler
    context.mongoConnection = dbConnection;

    // db.open doesn't happen right away; we pass a callback function
    // to know when it succeeds
    dbConnection.open(function(err) {
      if (err)
      {
        // If something goes wrong, call the callback with the error so
        // server.js is aware of the problem
        callback(err);
      }
      // Fetch a MongoDB "collection" (like a table in SQL databases)
      postCollection = dbConnection.collection('post');

      // Make sure that collection has a unique index on the "slug" field
      // before we continue. This ensures we don't have two blog posts
      // with the same slug. Once again, we pass a callback function
      postCollection.ensureIndex("slug", { unique: true }, function(err, indexName) 
      {
        // Now the database is ready to use (or an error has occurred). Invoke the callback
        callback(err);
      });
    });
  },
  // Group the methods relating to posts into a "posts" object, so we
  // can call db.posts.findAll, etc.
  posts: {
    // Find all posts in reverse order (blog order)
    findAll: function(callback) {
      postCollection.find().sort({created: -1}).toArray(function(err, posts) {
        callback(err, posts);
      });
    },
    findAllSummaries: function(callback) {
      var summaries = db.cache.get('summaries', function(err, summaries) {
        if (summaries)
        {
          callback(null, summaries);
        }
        db.posts.findAll(function(err, posts) {
          if (err)
          {
            callback(err);
            return;
          }
          // 100 word limit on each summary, HTML removed. TODO: release this as an npm module
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
          db.cache.set('summaries', posts, function(err) {
            callback(err, posts);
          });
        });
      });
    },
    // Fetch a particular post by its slug
    findOneBySlug: function(slug, callback) {
      postCollection.findOne({slug: slug}, function(err, post) {
        callback(err, post);
      });
    },
    // Insert a new post
    insert: function(post, callback) {
      var post = _.pick(_.defaults(post, { 'title': '', 'body': '' }), ['title', 'body']);
      // Create a reasonable slug from the title
      post.slug = db.slugify(post.title);
      // Set the creation date/time
      post.created = new Date();
      // Pass the 'safe' option so that we can tell immediately if
      // the insert fails (due to a duplicate slug, for instance)
      postCollection.insert(post, { safe: true }, function(err) {
        if (err)
        {
          callback(err);
        } 
        else
        {
          callback(err, post);
        }
      });
    },
    // Update an existing post
    update: function(slug, post, callback) {
      var post = _.pick(_.defaults(post, { 'title': '', 'body': '' }), ['title', 'body']);
      // Pass the 'safe' option so that we can tell immediately if
      // the update fails (due to a duplicate slug, for instance)
      postCollection.update({ slug: slug }, post, { safe: true }, function(err) {
        if (err)
        {
          callback(err);
        } 
        else
        {
          callback(err, post);
        }
      });
    },
    // Update an existing post
    remove: function(slug, callback) {
      postCollection.remove({ slug: slug }, { safe: true }, function(err) {
        callback(err);
      });
    },
  },
  cache: {
    set: function(key, data, callback)
    {
      cache[key] = JSON.stringify(data);
      return callback(null);
    },
    get: function(key, callback)
    {
      if (cache[key])
      {
        var result = JSON.parse(cache[key]);
        return callback(null, result);
      }
      return callback(null, undefined);
    },
    remove: function(key, callback)
    {
      cache[key] = undefined;
      return callback(null);
    },
    has: function(key, callback)
    {
      var result = (cache[key] !== undefined);
      return callback(null, result);
    }
  },
  // Create a reasonable slug for use in URLs based on the supplied string
  slugify: function(s)
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
};

