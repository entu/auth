var _        = require('underscore')
var google   = require('passport-google-oauth').OAuth2Strategy
var op       = require('object-path')
var passport = require('passport')
var router   = require('express').Router()

var entu   = require('../../helpers/entu')



passport.use(new google({
        clientID: GOOGLE_ID,
        clientSecret: GOOGLE_SECRET,
        callbackURL: '/auth/google/callback',
        proxy: true
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            return done(null, profile)
        })
    }
))



router.get('/', function(req, res) {
    res.clearCookie('redirect', {
        domain: APP_COOKIE_DOMAIN
    })
    res.clearCookie('session', {
        domain: APP_COOKIE_DOMAIN
    })

    if(req.query.next) {
        res.cookie('redirect', req.query.next, {
            maxAge: 60 * 60 * 1000,
            domain: APP_COOKIE_DOMAIN
        })
    }

    res.redirect('/auth/google/auth')
})



router.get('/auth', passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'], session: false }), function() {

})



router.get('/callback', passport.authenticate('google', { failureRedirect: '/login', session: false }), function(req, res, next) {
    var user = {}
    var name = _.compact([
        op.get(req, ['user', 'name', 'givenName']),
        op.get(req, ['user', 'name', 'middleName']),
        op.get(req, ['user', 'name', 'familyName'])
    ]).join(' ')

    op.set(user, 'provider', 'google')
    op.set(user, 'id', op.get(req, ['user', 'id']))
    op.set(user, 'name', name)
    op.set(user, 'email', op.get(req, ['user', 'emails', 0, 'value']))
    op.set(user, 'picture', op.get(req, ['user', 'photos', 0, 'value']).replace('?sz=50', ''))

    entu.sessionStart({
        request: req,
        response: res,
        user: user
    }, function(err, session) {
        if(err) { return next(err) }

        var redirectUrl = req.cookies.redirect
        if(redirectUrl) {
            res.cookie('session', session.key, {
                maxAge: 14 * 24 * 60 * 60 * 1000,
                domain: APP_COOKIE_DOMAIN
            })
            res.clearCookie('redirect', {
                domain: APP_COOKIE_DOMAIN
            })
            res.redirect(redirectUrl)
        } else {
            res.send({
                result: session,
                version: APP_VERSION,
                started: APP_STARTED
            })
        }
    })
})



module.exports = router
