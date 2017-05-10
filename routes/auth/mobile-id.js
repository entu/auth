var _      = require('underscore')
var async  = require('async')
var op     = require('object-path')
var random = require('randomstring')
var router = require('express').Router()
var soap   = require('soap')

var entu   = require('../../helpers/entu')



router.post('/', function(req, res, next) {
    const spChallenge = random.generate({ length: 20, charset: 'hex', capitalization: 'uppercase' })
    var soapClient

    console.log(spChallenge)

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
            soapClient = client

            soapClient.MobileAuthenticate({
                IDCode: req.body.idcode,
                CountryCode: 'EE',
                PhoneNo: req.body.phone,
                ServiceName: MOBILE_ID,
                MessagingMode: 'asynchClientServer',
                Language: 'EST',
                // MessageToDisplay: '',
                SPChallenge: spChallenge,
            }, callback)
        },
        function (session, callback) {
            if (!op.get(session, ['Sesscode', '$value'])) {
                return callback(new Error('No MobileAuthenticate session'))
            }

            if (op.get(session, ['Challenge', '$value']).substr(0, 20) !== spChallenge) {
                return callback(new Error('Challenge mismatch'))
            }

            var user = {}
            var name = _.compact([
                op.get(session, ['UserGivenname', '$value']),
                op.get(session, ['UserSurname', '$value'])
            ]).join(' ')

            op.set(user, 'provider', 'mobile-id')
            op.set(user, 'id', op.get(session, ['UserIDCode', '$value']))
            op.set(user, 'name', name)
            op.set(user, 'email', op.get(session, ['UserIDCode', '$value']) + '@eesti.ee')

            entu.setMobileIdSession({
                id: op.get(session, ['Sesscode', '$value']),
                code: op.get(session, ['Challenge', '$value']),
                idcode: req.body.idcode,
                phone: req.body.phone,
                user: user
            }, function (err, session) {
                callback(err, session)
            })

            // soapClient.GetMobileAuthenticateStatus({
            //     Sesscode: op.get(session, 'Sesscode.$value'),
            //     WaitSignature: false,
            // }, callback)
        },
    ], function (err, result) {
        if(err) { return next(err) }

        res.send({
            result: result,
            version: APP_VERSION,
            started: APP_STARTED
        })
    })
})



module.exports = router
