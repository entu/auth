var _      = require('underscore')
var async  = require('async')
var axios  = require('axios')
var crypto = require('crypto')
var op     = require('object-path')
var router = require('express').Router()

var entu   = require('../../helpers/entu')



function zeroPad (num, places) {
    return String(num).padStart(places, '0')
}



router.post('/', function(req, res, next) {
    var hash = crypto.randomBytes(32).toString('hex')
    var hashBuffer = Buffer.from(hash, 'hex')
    var binArray = []

    for (const v of hashBuffer.values()) {
        binArray.push(zeroPad(v.toString(2), 8))
    }

    var bin = binArray.join('')
    var newBinary = bin.substr(0, 6) + bin.substr(-7)
    var pin = zeroPad(parseInt(newBinary, 2), 4)

    async.waterfall([
        function (callback) {
            if (req.body.idcode) {
                callback(null)
            } else {
                callback([400, new Error('No idcode')])
            }
        },
        function (callback) {
            axios.post('https://mid.sk.ee/mid-api/authentication', {
                relyingPartyName: MID_NAME,
                relyingPartyUUID: MID_UUID,
                phoneNumber: req.body.phone,
                nationalIdentityNumber: req.body.idcode,
                hash: hashBuffer.toString('base64'),
                hashType: 'SHA256',
                language: 'EST'
            })
            .then((response) => {
                callback(null, response.data)
            })
            .catch((error) => {
                console.error('SK ERROR:', error.response.data)

                callback(error)
            })
        },
        function (session, callback) {
            if (!session.sessionID) {
                return callback(new Error('No MID authentication sessionID'))
            }

            entu.startMobileIdSession({
                sessionID: session.sessionID,
                hash: hash,
                user: {
                    provider: 'mobile-id',
                    id: req.body.idcode,
                    name: req.body.idcode,
                    email: req.body.idcode + '@eesti.ee'
                }
            }, callback)
        },
    ], function (err, result) {
        if(err) { return next(err) }

        res.send({
            result: {
                key: result,
                code: pin
            },
            version: APP_VERSION,
            started: APP_STARTED
        })
    })
})



router.post('/:key', function(req, res, next) {
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
            console.log(session);

            axios.get('https://mid.sk.ee/mid-api/authentication/session/' + session.sessionID)
            .then((response) => {
                callback(null, response.data)
            })
            .catch((error) => {
                console.error('SK ERROR:', error.response.data)

                callback(error)
            })
        },
        function (session, callback) {
            if (session.state === 'COMPLETE') {
                entu.updateMobileIdSessionStatus(req.params.key, session.result, callback)
            } else {
                callback(null)
            }
        },
    ], function (err, status) {
        if(err) { return next(err) }

        if (!status) {
            res.send({
                result: { in_progress: true },
                version: APP_VERSION,
                started: APP_STARTED
            })
        } else if (status === 'OK') {
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
            if (op.get(midSession, 'status') !== 'OK') {
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
