// Settings for our app. The 'require' call in server.js returns
// whatever we assign to 'module.exports' in this file

module.exports = { 
  // MongoDB database settings
  db: {
    host: '127.0.0.1',
    port: 27017,
    name: 'justjsblogdemo'
  },
  // Port for the webserver to listen on
  http: {
    port: 3000
  },
  // You should use a secret of your own to authenticate session cookies
  sessionSecret: 'CHANGEME',
  google: {
    returnURL: 'http://localhost:3000/auth/google/callback',
    realm: 'http://localhost:3000/'
  },
  // Match anyone who works at my office
  posters: '*@punkave.com'
  // Match just me
  // posters: 'tom@punkave.com'
};
