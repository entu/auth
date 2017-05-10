var async  = require('async')
var router = require('express').Router()
var soap   = require('soap')



router.post('/', function(req, res, next) {
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
            var parameters = {
                IDCode: req.body.idcode,
                PhoneNo: req.body.phone,
                ServiceName: MOBILE_ID,
                MessagingMode: 'asynchClientServer',
                Language: 'EST',
                // MessageToDisplay: '',
                // SPChallenge: '',
            }

            client.MobileAuthenticate(parameters, function(err, result) {
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
