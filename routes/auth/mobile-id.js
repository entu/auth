var _      = require('underscore')
var async  = require('async')
var op     = require('object-path')
var random = require('randomstring')
var router = require('express').Router()
var soap   = require('soap')

var entu   = require('../../helpers/entu')



router.post('/', function(req, res, next) {
    const spChallenge = random.generate({ length: 20, charset: 'hex' })
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
            if (!op(session, 'Sesscode.$value')) {
                return callback(new Error('No MobileAuthenticate session'))
            }

            if (op(session, 'Challenge.$value') !== spChallenge) {
                console.log(op(session, 'Challenge.$value'))
                // return callback(new Error('Challenge mismatch'))
            }

            soapClient.GetMobileAuthenticateStatus({
                Sesscode: op(session, 'Sesscode.$value'),
                WaitSignature: true,
            }, callback)
        },
    ], function (err, result) {
        if(err) { return next(err) }

        console.log(JSON.stringify(result, false, '  '))

        res.send({})
    })
})



module.exports = router
