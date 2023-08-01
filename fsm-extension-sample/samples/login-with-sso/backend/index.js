var express = require('express')
  , fetch = require('node-fetch')
  , path = require('path')
  , passport = require('passport')
  , OAuth2Strategy = require('passport-oauth').OAuth2Strategy
  , jwt = require('jsonwebtoken')
  , BearerStrategy = require('passport-http-bearer').Strategy
  , session = require("express-session")
  , bodyParser = require("body-parser")
  // For demo purpose, provide a mocked db to handle user
  , User = require('./users')
  , cloud = require('./cloud')
  , middlewares = require('./middlewares')
  , credentials = require('./credentials');
;

const {
  SECRET_KEY
} = process.env;

// Demo is based on express node server
const app = express();

//////////////////////////////////////////////////////////////////////
//
// STEP 1. provide passport urls to interface with openid connect
// 
//////////////////////////////////////////////////////////////////////

// oauth2 api : /auth/provider redirect to the idp login page, 
// then back to IDP_URL_CALLBACK with authorization code value  
app.get('/auth/provider/:cloudHost/:account/:companyId/', function(req, res, next) {

  if (!credentials.client_credentials[req.params.cloudHost] || 
      !credentials.client_credentials[req.params.cloudHost][req.params.account]) {
    res.redirect("/configure.html");
  } else {
    const provider = `provider-${req.params.cloudHost}-${req.params.account}`;

    const credential = credentials.client_credentials[req.params.cloudHost][req.params.account];
    // Configure passportjs with oauth2 configuration values 
    // and a return function how to handle the jwt token
    passport.use(provider, new OAuth2Strategy({
        clientID: credential.idp.clientID,
        clientSecret: credential.idp.clientSecret,
        authorizationURL: credential.idp.authorizationURL,
        tokenURL: credential.idp.tokenURL,
        callbackURL: credential.idp.callbackURL,
        customHeaders: {
          'Authorization': 'Basic ' + Buffer.from(`${credential.idp.clientID}:${credential.idp.clientSecret}`, 'utf-8').toString('base64')
        }
      },
      function(jwtToken, refreshToken, profile, done) {
        // jwtToken is retuned by the IDP with the user mail, as configured within the openid profile
        done(null, jwtToken ? jwt.decode(jwtToken).mail : false);
      }
    ));

    passport.authenticate(provider, { scope: 'openid' })(req, res, next)
  }
});

// oauth2 api : /auth/provider/callback receive the authorization code with context header.
// then ask IDP for the profile, compare with header userID email to IDP, if same return
// bearer token.
app.get('/auth/provider/callback', function(req, res, next) {

  const provider = `provider-${req.headers['cloudhost']}-${req.headers['account']}`;

  passport.authenticate(provider, async function(err, mail, info) {
    if (err) { return next(err); }
    if (!mail) { return res.status(401).send({ message: 'Login failed on IDP' }); }

    try {
      // Verify if IDP account has same email as FSM user. 
      const userObject = await cloud.queryUserObject(req.headers['cloudhost'], req.headers['account'], req.headers['userid']);

      if (userObject.email == mail) {
        // A user is defined by its cloudhost, account, and fsm user id
        // For the purpose of this demo, we populate cloudhost and account to the user object
        userObject.cluster_url = req.headers['cloudhost'];
        userObject.account = req.headers['account'];
        userObject.companyId = req.headers['companyid'];

        // Get local user and bearer token associated
        // This minimalist example should be enhanced with stronger token protection
        User.findOrCreate(userObject, function(err, userObject, token) {
          return err ? next(err) : res.json({ token });
        });
      } else {
        return res.status(401).send({ message: 'IdP and Shell users do not have matching emails' });
      }
    } catch (e) {
      return res.status(401).send({ message: e.message });
    }
  })(req, res, next);
});

// Configure
app.post(
  '/configure/', 
  bodyParser.urlencoded({ extended: false }), 
  function(req, res, next) {

    const cloudhost = req.body['cloudHost'];
    const account = req.body['account'];
    const clientId = req.body['clientId'];
    const clientSecret = req.body['clientSecret'];
    const idpClientId = req.body['idpClientId'];
    const idpClientSecret = req.body['idpClientSecret'];
    const authorizationURL = req.body['authorizationURL'];
    const tokenURL = req.body['tokenURL'];
    const callbackURL = req.body['callbackURL'];

    credentials.add_configuration(cloudhost, account, {
      'client_id': clientId,
      'client_secret': clientSecret,
      'idp': {
        'clientID': idpClientId,
        'clientSecret': idpClientSecret,
        'authorizationURL': authorizationURL,
        'tokenURL': tokenURL,
        'callbackURL': callbackURL,
      }
    });

    return res.status(200).send({});
  });


//////////////////////////////////////////////////////////////////////
//
// STEP 2. Create a bearer token to protect extensions' API 
//
//////////////////////////////////////////////////////////////////////

// Passport use serializeUser to generate a string to associate to the bearer token
passport.serializeUser(function(user, done) {
  done(null, user.uuid);
});

// Passport use deserializeUser to fetch a user from the associated string from serializeUser
passport.deserializeUser(function(uuid, done) {
  User.findById(uuid, function(err, user) {
    done(err, user);
  });
});

// Passport fetch user from Bearer token
passport.use(new BearerStrategy(
  function(token, done) {
    User.findByToken(token, function (err, user) {
      if (err) { return done(err); }
      if (!user) { return done(null, false); }
      return done(null, user, { scope: 'read' });
    });
  }
));

//////////////////////////////////////////////////////////////////////
//
// STEP 3. Create protected REST API
//
//////////////////////////////////////////////////////////////////////

// //  Return user object based on the bearer Token
app.get('/api/me',
  middlewares.authenticate,
  function(req, res) {
    // middlewares.authenticate populate req with req.user, req.access_token
    res.json(req.user);
  });

//////////////////////////////////////////////////////////////////////
//
// STEP 4. Initialise express node server to listen http request.
//
//////////////////////////////////////////////////////////////////////
app.use(session({ secret: SECRET_KEY, resave: true, saveUninitialized: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(passport.initialize());
app.use(passport.session());

exports.initialize = () => app;