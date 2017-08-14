var _       = require('underscore')
var async   = require('async')
var fs      = require('fs')
var mongo   = require('mongodb')
var op      = require('object-path')
var random  = require('randomstring')
var request = require('request')



// returns db connection (creates if not set)
var dbConnection = function(db, callback) {
    async.series([
        function(callback) {
            if(_.has(APP_ENTU_DBS, db)) {
                APP_ENTU_DBS[db].admin().ping(callback)
            } else {
                callback(new Error('No db connection'))
            }
        },
    ], function(err) {
        if(!err) { return callback(null, APP_ENTU_DBS[db]) }

        mongo.MongoClient.connect(APP_MONGODB, { ssl: true, sslValidate: true, autoReconnect: true }, function(err, connection) {
            if(err) { return callback(err) }

            APP_ENTU_DBS[db] = connection
            callback(null, APP_ENTU_DBS[db])
        })
    })
}
exports.dbConnection = dbConnection



// Create requestlog entry on response finish
exports.requestLog = function(req, res, next) {
    var start = Date.now()

    res.on('finish', function() {
        var request = {
            date: new Date(),
            ip: req.ip,
            ms: Date.now() - start,
            status: res.statusCode,
            method: req.method,
            host: req.hostname,
            browser: req.headers['user-agent'],
        }
        if(req.path) { request.path = req.path }
        if(!_.isEmpty(req.query)) { request.query = req.query }
        if(!_.isEmpty(req.body)) { request.body = req.body }
        if(req.browser) { request.browser = req.headers['user-agent'] }

        async.waterfall([
            function(callback) {
                dbConnection('entu', callback)
            },
            function(connection, callback) {
                connection.collection('request').insertOne(request, callback)
            },
        ], function(err) {
            if(err) { return next(err) }
        })
    })

    next()
}



// Create requestlog entry on response finish
exports.getUserSession = function(req, res, next) {
    var session = req.get('X-Auth-Id')

    try {
        var session_id = new mongo.ObjectID(session.split('.')[0])
        var session_key = session.split('.')[1]
    } catch (e) {
        return next(null)
    }

    if(!session_id || !session_key) { return next(null) }

    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('session').findOne({ _id: session_id, key: session_key }, callback)
        },
    ], function(err, session) {
        if(err) { return next(err) }
        if(!session || !session._id || !session.key) { return next([403, 'No user']) }

        res.locals.user = session

        next()
    })
}



// Create user session
exports.sessionStart = function(params, callback) {
    if(!params.user) { return callback(new Error('No user')) }

    var session = {
        created: new Date(),
        key: random.generate(64),
    }

    if(op.get(params, 'user.id')) { op.set(session, 'user.id', op.get(params, 'user.id')) }
    if(op.get(params, 'user.provider')) { op.set(session, 'user.provider', op.get(params, 'user.provider')) }
    if(op.get(params, 'user.name')) { op.set(session, 'user.name', op.get(params, 'user.name')) }
    if(op.get(params, 'user.email')) { op.set(session, 'user.email', op.get(params, 'user.email')) }
    if(op.get(params, 'user.picture')) { op.set(session, 'user.picture', op.get(params, 'user.picture')) }
    if(op.get(params, 'request.ip')) { op.set(session, 'ip', op.get(params, 'request.ip')) }
    if(op.get(params, 'request.headers.user-agent')) { op.set(session, 'browser', op.get(params, 'request.headers.user-agent')) }
    if(op.get(params, 'request.query.next')) { op.set(session, 'redirect', op.get(params, 'request.query.next')) }
    if(op.get(params, 'request.cookies.redirect')) { op.set(session, 'redirect', op.get(params, 'request.cookies.redirect')) }

    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('session').insertOne(session, callback)
        },
    ], function(err, r) {
        if(err) { return callback(err) }
        if(!r) { return callback(r) }

        session._id = r.insertedId

        callback(null, session)
    })
}



// Destoy user session
exports.sessionEnd = function(sessionKey, callback) {
    if(!sessionKey) { return callback(new Error('No session key')) }

    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('session').deleteMany({key: sessionKey}, callback)
        },
    ], function(err) {
        if(err) { return callback(err) }

        callback(null, {})
    })
}



// Save mobile-id session
exports.startMobileIdSession = function(session, callback) {
    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('midSessions').insertOne({
                dt: new Date(),
                id: session.id,
                code: session.code,
                idcode: session.idcode,
                phone: session.phone,
                user: session.user
            }, callback)
        },
    ], function(err, r) {
        if(err) { return callback(err) }
        if(!r) { return callback(r) }

        callback(null, r.insertedId)
    })
}



// Get mobile-id session
exports.getMobileIdSession = function(key, callback) {
    try {
        var session_id = new mongo.ObjectID(key)
    } catch (e) {
        return callback(null)
    }

    if(!session_id) { return callback(null) }

    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('midSessions').findOne({ _id: session_id }, callback)
        },
    ], function(err, session) {
        if(err) { return callback(err) }
        if(!session || !session._id) { return callback([403, 'No session']) }

        callback(null, session)
    })
}



// Update mobile-id session
exports.updateMobileIdSessionStatus = function(key, status, callback) {
    try {
        var session_id = new mongo.ObjectID(key)
    } catch (e) {
        return callback(null)
    }

    if(!session_id) { return callback(null) }

    async.waterfall([
        function(callback) {
            dbConnection('entu', callback)
        },
        function(connection, callback) {
            connection.collection('midSessions').updateOne({ _id: session_id }, { $set: { status : status } }, callback)
        },
    ], function(err, session) {
        if(err) { return callback(err) }

        callback(null, status)
    })
}
