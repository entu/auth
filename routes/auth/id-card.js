var _      = require('underscore')
var async  = require('async')
var op     = require('object-path')
var router = require('express').Router()

var entu   = require('../../helpers/entu')



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

    res.redirect('https://id.auth.entu.ee/auth/id-card/callback')
})



router.get('/error', function(req, res) {
    var redirectUrl = req.cookies.redirect
    if(redirectUrl) {
        res.clearCookie('redirect', {
            domain: APP_COOKIE_DOMAIN
        })
        res.redirect(redirectUrl)
    } else {
        res.send({
            error: 'No required SSL certificate was sent',
            version: APP_VERSION,
            started: APP_STARTED
        })
    }
})



router.get('/callback', function(req, res, next) {
    async.waterfall([
        function (callback) {
            if (req.headers.ssl_client_verify === 'SUCCESS' && req.headers.ssl_client_s_dn) {
                callback(null, req.headers.ssl_client_s_dn)
            } else {
                callback(new Error('ID-Card reading error'))
            }
        },
        function (result, callback) {
            const regexp = [...result.matchAll(/([^=]*)=([^/]*)/g)]
            const profile = Object.fromEntries(regexp.map(function(r) {
                return [v[1].replace('/', ''), v[2]]
            }))

            var user = {}
            var name = _.compact([
                profile.GN,
                profile.SN
            ]).join(' ')

            op.set(user, 'provider', 'id-card')
            op.set(user, 'id', profile.serialNumber)
            op.set(user, 'name', name)
            op.set(user, 'email', profile.serialNumber + '@eesti.ee')

            entu.sessionStart({ request: req, response: res, user: user }, callback)
        }
    ], function (err, session) {
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
