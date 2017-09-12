var router   = require('express').Router()



router.get('/', function(req, res) {
    res.send({
        result: true,
        version: APP_VERSION,
        started: APP_STARTED
    })
})



router.get('/headers', function(req, res) {
    res.send(req.headers)
})



router.get('/test', function() {
    throw new Error('böö')
})



module.exports = router
