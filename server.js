var options = { 
  db: {
    host: '127.0.0.1',
    port: 27017,
    name: 'justjs'
  },
  http: {
    port: 3000
  },
  templates: {}
};

var _ = require('underscore');
var fs = require('fs');
var mongo = require('mongodb');
var app = require('express').createServer();

options.templates.post = _.template(fs.readFileSync(__dirname + '/templates/post._', 'utf8'));
options.templates.postBody = _.template(fs.readFileSync(__dirname + '/templates/postBody._', 'utf8'));
options.templates.layout = _.template(fs.readFileSync(__dirname + '/templates/layout._', 'utf8'));

var db;
var postCollection;

sequence([connect, listen], ready);

// Accepts an array of functions that expect a callback function and calls them asynchronously
// in sequence. This is useful for app initialization and other truly serial tasks.
//
// As each one completes the next is invoked if no error has so far occurred. When the entire 
// sequence completes 'callback' is invoked; if an error is passed to 'callback', one of the 
// operations failed.

function sequence(operations, callback)
{
  if (operations.length)
  {
    operations[0](null, function(err) {
      if (err)
      {
        callback(err);
        return;
      }
      sequence(operations.slice(1), callback);
    });
  }
  else
  {
    callback(null);
  }
}

function connect(err, callback)
{
  db = new mongo.Db(options.db.name, new mongo.Server(options.db.host, options.db.port, {}), {});
  db.open(function(err, client) {
    postCollection = db.collection('post');
    postCollection.ensureIndex("slug", { unique: true }, function(err, indexName) 
    {
      console.log('Database initialized');
      callback(err);
    });
  });
}

function listen(err, callback)
{
  if (!err)
  {
    app.listen(options.http.port);  
    console.log("Listening on port " + options.http.port);
  }
  callback(err);
};

function ready(err)
{
  if (err)
  {
    console.log("Uh-oh");
    console.log(err);
  }
  else
  {
    console.log("Ready");
  }
}

app.get('/', function(req, res) {
  postCollection.find().sort({created: -1}).toArray(function(err, posts) {
    if (err)
    {
      throw err;
    }
    sendPage(res, 'index', { posts: posts });
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
      sendPage(res, 'post', { post: post });
    }
    else
    {
      res.status(404);
      res.send('Post Not Found');
    }
  });
});

// Render a page template nested in the layout, allowing slots 
// (such as overrides of the page title) to be passed back to the layout 
function sendPage(res, template, data)
{
  var slots = {};
  _.defaults(data, { slots: slots });
  slots.body = renderPartial(template, data);
  res.send(renderPartial('layout', { slots: slots }));
}

function renderPartial(template, data)
{
  if (_.isUndefined(options.templates[template]))
  {
    options.templates[template] = _.template(fs.readFileSync(__dirname + '/templates/' + template + '._', 'utf8'));
  }
  _.defaults(data, { options: options, slots: {}, partial: function(partial, partialData) {
    _.defaults(partialData, { slots: data.slots });
    return renderPartial(partial, partialData);
  }});
  return options.templates[template](data);
}
