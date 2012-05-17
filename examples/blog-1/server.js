// With Node, every website is actually a webserver unto itself.
// Webservers speak HTTP. So we require the HTTP module.

var http = require('http');

// Let's set up a few posts for our bare-bones blog so that
// we can tell it's working. We'll store them in a database later.

// For now each post is a property of the posts object. The "slug," a
// unique URL for the post, is the name of each property.

var posts = {
  '/welcome-to-my-blog': {
    title: 'Welcome to my blog!',
    body: 'I am so glad you came.'
  },
  '/i-am-concerned-about-stuff': {
    title: 'I am concerned about stuff!',
    body: 'People need to be more careful with stuff.'
  },
  '/i-often-dream-of-trains': {
    title: 'I often dream of trains.',
    body: "I often dream of trains when I'm alone."
  }
};

// Now let's create a webserver. All we have to do is pass
// a callback function - a function that Node will call for
// us every time a request arrives.

var server = http.createServer(function(req, res) {
  if (req.url === '/')
  {
    // Deliver a list of posts
    index();
  }
  else if (posts[req.url])
  {
    // Deliver this particular post
    post(req.url);
  }
  else
  {
    notFound();
  }

  // Deliver a list of posts

  // Notice that the 'index' function can still see
  // the 'res' variable, because it is nested inside
  // the callback function

  function index()
  {
    // Build some really basic HTML (yes, it's missing
    // lots of important things)
    var s = "<title>My Blog</title>\n";
    s += "<h1>My Blog</h1>\n";
    s += "<ul>\n";
    for (var slug in posts)
    {
      var post = posts[slug];
      s += '<li><a href="' + slug + '">' + post.title + '</a></li>' + "\n";
    }
    s += "</ul>\n";
    sendBody(s);
  }

  // Deliver this particular post
  function post(url)
  {
    var post = posts[url];
    var s = "<title>" + post.title + "</title>\n";
    s += "<h1>My Blog</h1>\n";
    s += "<h2>" + post.title + "</h2>\n";
    s += post.body;
    sendBody(s);
  }

  function sendBody(s)
  {
    // Send the response header. A successful HTTP request has
    // status code 200, and we want to send back HTML
    res.writeHead(200, {'Content-Type': 'text/html'});
    // Now send the body of the response
    res.end(s);
  }

  // Deliver a 404 not found error
  function notFound()
  {
    // Give a nice 404 not found response
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end('<h1>Post not found.</h1>');
  }
});

// Now let's listen for connections on port 3000.
// Our little webserver can be reached via this URL:
// http://localhost:3000/
server.listen(3000);

// The server is waiting for connections. Print a 
// helpful message so we know it's ready.
console.log("Listening for connections");
