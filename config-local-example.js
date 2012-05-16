// These settings merge with 'options' in server.js. Copy this file to
// config-local.js. That file is ignored via .gitignore so that your private
// API keys don't wind up in github

module.exports = {
  twitter: {
    // You need to go to dev.twitter.com and register your own app to get these!
    consumerKey: 'getmefromtwitter',
    consumerSecret: 'getmefromtwitter',
    // Hint: point this to 127.0.0.1 via /etc/hosts for easy testing with a
    // URL that Twitter will accept. On your production server change to 
    // a real hostname. I have two apps registered with Twitter,
    // justjs (the real one) and devjustjs (for testing on my own computer)

    // ACHTUNG: you must visit your site at dev.justjs.com:3000, not localhost:3000,
    // otherwise you'll get session-related errors on login.
    callbackURL: 'http://dev.justjs.com:3000/auth/twitter/callback'
  }
  // Should be unique to your site. Used to hash session identifiers
  // so they can't be easily hijacked
  sessionSecret: 'CHANGEME',

  // Replace with YOUR twitter username
  admin: 'boutell',
  googleAnalytics: 'UA-XXXXXXX',

  // In production you'd most likely drop the dev. and the port number
  url: 'http://dev.justjs.com:3000'
};
