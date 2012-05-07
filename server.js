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

options.templates.index = _.template(fs.readFileSync(__dirname + '/templates/index._', 'utf8'));
options.templates.post = _.template(fs.readFileSync(__dirname + '/templates/post._', 'utf8'));
options.templates.postBody = _.template(fs.readFileSync(__dirname + '/templates/postBody._', 'utf8'));
options.templates.layout = _.template(fs.readFileSync(__dirname + '/templates/layout._', 'utf8'));

var db;
var postCollection;

app.get('/', function(req, res) {
  postCollection.find().sort({created: -1}).toArray(function(err, posts) {
    if (err)
    {
      throw err;
    }
    var slots = {};
    slots.body = options.templates.index({ posts: posts, options: options, slots: slots });
    res.send(options.templates.layout({ slots: slots }));
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
      var slots = {};
      slots.body = options.templates.post({ post: post, options: options, slots: slots });
      res.send(options.templates.layout({ slots: slots }));
    }
    else
    {
      res.status(404);
      res.send('Post Not Found');
    }
  });
});

db = new mongo.Db(options.db.name, new mongo.Server(options.db.host, options.db.port, {}), {});
db.open(function(err, client) {
  postCollection = db.collection('post');
  postCollection.ensureIndex("slug", { unique: true }, function(err, callback) 
  {
    if (err)
    {
      throw err;
    }
    ready();
  });
});

function ready()
{
  app.listen(options.http.port);  
  console.log("Listening on port " + options.http.port);
};
