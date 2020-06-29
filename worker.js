var bparser  = require('body-parser')
var cparser  = require('cookie-parser')
var express  = require('express')
var passport = require('passport')

var entu     = require('./helpers/entu')



// global variables (and list of all used environment variables)
APP_VERSION        = process.env.VERSION || require('./package').version
APP_STARTED        = new Date().toISOString()
APP_PORT           = process.env.PORT || 3000
APP_COOKIE_DOMAIN  = process.env.COOKIE_DOMAIN || ''
APP_MONGODB        = process.env.MONGODB || 'mongodb://entu_mongodb:27017/'

MOBILE_ID = process.env.MOBILE_ID

GOOGLE_ID = process.env.GOOGLE_ID
GOOGLE_SECRET = process.env.GOOGLE_SECRET

TAAT_ENTRYPOINT = process.env.TAAT_ENTRYPOINT
TAAT_ISSUER = process.env.TAAT_ISSUER
TAAT_CERT = process.env.TAAT_CERT
TAAT_PRIVATECERT = process.env.TAAT_PRIVATECERT

APP_ENTU_DBS = {}



// passport (de)serialize
passport.serializeUser(function(user, done) {
    done(null, user)
})

passport.deserializeUser(function(user, done) {
    done(null, user)
})



// start express app
var app = express()

// Hide Powered By
app.disable('x-powered-by')

// get correct client IP behind nginx
app.set('trust proxy', true)

// Initialize Passport
app.use(passport.initialize())

// parse Cookies
app.use(cparser())

// parse POST requests
app.use(bparser.json())
app.use(bparser.urlencoded({extended: true}))

// save request info to request collection and get user session
app.use(entu.requestLog)
app.use(entu.getUserSession)

//CORS
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
    next()
})

// routes mapping
app.use('/', require('./routes/index'))
app.use('/auth/exit', require('./routes/auth/exit'))
app.use('/status', require('./routes/status'))
app.use('/user', require('./routes/user'))

// provider mapping (only if configured)
app.use('/auth/id-card', require('./routes/auth/id-card'))

if(MOBILE_ID) { app.use('/auth/mobile-id', require('./routes/auth/mobile-id')) }
if(GOOGLE_ID && GOOGLE_SECRET) { app.use('/auth/google', require('./routes/auth/google')) }
if(TAAT_ENTRYPOINT && TAAT_CERT && TAAT_PRIVATECERT) { app.use('/auth/taat', require('./routes/auth/taat')) }

// show 404
app.use(function(req, res, next) {
    next([404, new Error('not found')])
})

// show error
app.use(function(err, req, res, next) {
    var code = 500
    var error = err
    if (err.constructor === Array) {
        code = err[0]
        error = err[1]
    }
    res.status(code).send({
        error: error.toString(),
        version: APP_VERSION,
        started: APP_STARTED
    })
})

// start server
app.listen(APP_PORT, function() {
    console.log(new Date().toString() + ' started listening port ' + APP_PORT)
})
