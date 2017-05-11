var _      = require('underscore')
var async  = require('async')
var op     = require('object-path')
var random = require('randomstring')
var router = require('express').Router()
var soap   = require('soap')

var entu   = require('../../helpers/entu')



router.post('/', function(req, res, next) {
    const spChallenge = random.generate({ length: 20, charset: 'hex', capitalization: 'uppercase' })
    var challengeID

    async.waterfall([
        function (callback) {
            if (req.body.idcode) {
                callback(null)
            } else {
                callback([400, new Error('No idcode')])
            }
        },
        function (callback) {
            soap.createClient('https://digidocservice.sk.ee/?wsdl', {}, callback)
        },
        function (client, callback) {
            client.MobileAuthenticate({
                IDCode: req.body.idcode,
                CountryCode: 'EE',
                PhoneNo: req.body.phone,
                ServiceName: MOBILE_ID,
                MessagingMode: 'asynchClientServer',
                Language: 'EST',
                // MessageToDisplay: '',
                SPChallenge: spChallenge,
            }, function(err, result) {
                if(err) { return callback(err) }

                callback(null, result)
            })
        },
        function (session, callback) {
            if (op.get(session, ['Status', '$value']) !== 'OK') {
                return callback(new Error('MobileAuthenticate status not OK'))
            }

            if (!op.get(session, ['Sesscode', '$value'])) {
                return callback(new Error('No MobileAuthenticate session'))
            }

            if (op.get(session, ['Challenge', '$value']).substr(0, 20) !== spChallenge) {
                return callback(new Error('Challenge mismatch'))
            }

            challengeID = op.get(session, ['ChallengeID', '$value'])

            var user = {}
            var name = _.compact([
                op.get(session, ['UserGivenname', '$value']),
                op.get(session, ['UserSurname', '$value'])
            ]).join(' ')

            op.set(user, 'provider', 'mobile-id')
            op.set(user, 'id', op.get(session, ['UserIDCode', '$value']))
            op.set(user, 'name', name)
            op.set(user, 'email', op.get(session, ['UserIDCode', '$value']) + '@eesti.ee')

            entu.startMobileIdSession({
                id: op.get(session, ['Sesscode', '$value']),
                code: op.get(session, ['ChallengeID', '$value']),
                idcode: req.body.idcode,
                phone: req.body.phone,
                redirect: req.body.next,
                user: user
            }, callback)
        },
    ], function (err, result) {
        if(err) { return next(err) }

        res.send({
            result: {
                key: result,
                code: challengeID
            },
            version: APP_VERSION,
            started: APP_STARTED
        })
    })
})



router.post('/:key', function(req, res, next) {
    var midSession

    async.waterfall([
        function (callback) {
            if (req.params.key) {
                callback(null)
            } else {
                callback([400, new Error('No key')])
            }
        },
        function (callback) {
            entu.getMobileIdSession(req.params.key, callback)
        },
        function (session, callback) {
            midSession = session
            soap.createClient('https://digidocservice.sk.ee/?wsdl', {}, callback)
        },
        function (client, callback) {
            client.GetMobileAuthenticateStatus({
                Sesscode: op.get(midSession, 'id'),
                WaitSignature: false,
            }, function(err, result) {
                if(err) { return callback(err) }

                callback(null, result)
            })
        },
        function (session, callback) {
            entu.updateMobileIdSessionStatus(req.params.key, op.get(session, ['Status', '$value']), callback)
        },
    ], function (err, status) {
        if(err) { return next(err) }

        if (status === 'OUTSTANDING_TRANSACTION') {
            res.send({
                result: { in_progress: true },
                version: APP_VERSION,
                started: APP_STARTED
            })
        } else if (status === 'USER_AUTHENTICATED') {
            res.send({
                result: { authenticated: true },
                version: APP_VERSION,
                started: APP_STARTED
            })
        } else {
            next([403, new Error(status || 'User not authenticated')])
        }
    })
})



router.get('/:key', function(req, res, next) {
    var midSession

    async.waterfall([
        function (callback) {
            if (req.params.key) {
                callback(null)
            } else {
                callback([400, new Error('No key')])
            }
        },
        function (callback) {
            entu.getMobileIdSession(req.params.key, callback)
        },
        function (midSession, callback) {
            if (op.get(midSession, 'status') !== 'USER_AUTHENTICATED') {
                return callback([403, op.get(midSession, 'status', 'User not authenticated')])
            }

            entu.sessionStart({ request: req, response: res, user: op.get(midSession, 'user', {}) }, callback)
        },
    ], function (err, session) {
        if(err) { return next(err) }

        var redirectUrl = req.query.next
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
