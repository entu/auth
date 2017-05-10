var async  = require('async')
var op     = require('object-path')
var random = require('randomstring')
var router = require('express').Router()
var soap   = require('soap')



router.post('/', function(req, res, next) {
    const spChallenge = random.generate({ length: 20, charset: 'hex' })
    var soapClient

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

            var parameters = {
                IDCode: req.body.idcode,
                CountryCode: 'EE',
                PhoneNo: req.body.phone,
                ServiceName: MOBILE_ID,
                MessagingMode: 'asynchClientServer',
                Language: 'EST',
                // MessageToDisplay: '',
                SPChallenge: spChallenge,
            }

            soapClient.MobileAuthenticate(parameters, function(err, result) {
                if(err) { return callback(err) }

                console.log(JSON.stringify(err, false, '  '))
                console.log(JSON.stringify(result, false, '  '))

                callback(null, result)
            })
        },
        function (session, callback) {
            if (!op(session, 'Sesscode.$value')) {
                return callback(new Error('No MobileAuthenticate session'))
            }

            if (op(session, 'Challenge.$value') !== spChallenge) {
                return callback(new Error('Challenge mismatch'))
            }

            var parameters = {
                Sesscode: op(session, 'Sesscode.$value'),
                WaitSignature: true,
            }

            soapClient.GetMobileAuthenticateStatus(parameters, function(err, result) {
                if(err) { return callback(err) }

                console.log(JSON.stringify(err, false, '  '))
                console.log(JSON.stringify(result, false, '  '))

                callback(null, result)
            })
        },
    ], function (err, session) {
        if(err) { return next(err) }

        res.send({})
    })
})



module.exports = router
