// Bring in Express, which provides its own server objects that
// wrap Node's http module

var express = require('express');

// Let's set up a few posts for our bare-bones blog so that
// we can tell it's working. We'll store them in a database later.

// For now each post is a property of the posts object. The "slug," a
// unique URL for the post, is the name of each property.

var posts = {
  'welcome-to-my-blog': {
    title: 'Welcome to my blog!',
    body: 'I am so glad you came.'
  },
  'i-am-concerned-about-stuff': {
    title: 'I am concerned about stuff!',
    body: 'People need to be more careful with stuff.'
  },
  'i-often-dream-of-trains': {
    title: 'I often dream of trains.',
    body: "I often dream of trains when I'm alone."
  }
};

// Create an Express app object to add routes to
var app = require('express').createServer();

// Deliver a list of posts when we see just '/'
app.get('/', function(req, res) {
  // Build some really basic HTML (yes, it's missing
  // lots of important things)
  var s = "<title>My Blog</title>\n";
  s += "<h1>My Blog</h1>\n";
  s += "<ul>\n";
  for (var slug in posts)
  {
    var post = posts[slug];
    s += '<li><a href="/posts/' + slug + '">' + post.title + '</a></li>' + "\n";
  }
  s += "</ul>\n";
  // res.send does what our sendBody function did in the previous version
  // by default
  res.send(s);
});

// Deliver a specific post when we see /posts/ 
app.get('/posts/:slug', function(req, res) {
  var post = posts[req.params.slug];
  if (typeof(post) === 'undefined')
  {
    notFound(res);
    return;
  }
  var s = "<title>" + post.title + "</title>\n";
  s += "<h1>My Blog</h1>\n";
  s += "<h2>" + post.title + "</h2>\n";
  s += post.body;
  res.send(s);
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

// Now let's listen for connections on port 3000.
// Our little webserver can be reached via this URL:
// http://localhost:3000/
app.listen(3000);

// The server is waiting for connections. Print a 
// helpful message so we know it's ready.
console.log("Listening for connections");