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

var db;
var postCollection;

app.get('/', function(req, res) {
  postCollection.find().sort({created: -1}).toArray(function(err, posts) {
    if (err)
    {
      throw err;
    }
    res.send(options.templates.index({ 'posts': posts, 'options': options }));
  });
});

db = new mongo.Db(options.db.name, new mongo.Server(options.db.host, options.db.port, {}), {});
db.open(function(err, client) {
  postCollection = db.collection('post');
  app.listen(options.http.port);  
  console.log("Listening on port " + options.http.port);
});
