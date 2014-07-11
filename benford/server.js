var config = require(__dirname+"/config.js");

var express = require('express');
var r = require('rethinkdb');
var Promise = require('bluebird');

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

var sticky = require('sticky-session');

var delay = 5000; // Delay to restart everything in case of an error

// We do not use directly the `cluster` modules because socket.io won't work
// sticky will use the request's ip such that a client always connect to the same server
sticky(function() {
    var app = express();
    var io;

    // Serve static content
    app.use(express.static(__dirname + '/public'));

    var server = require('http').createServer(app);

    // Initialize the values for each significant digits with what we have in the database
    var alldata = {}; // digit -> occurrence

    listen(alldata, server, 0, io)

    return server;
}).listen(config.http.port, function() {
    console.log('Server listenening at port %d', config.http.port)
});


function listen(alldata, server, failedAttempts, io) { 
    // alldata: object with digit -> occurrence
    // server: require('htt').createServer(...)
    // failedAttempts: number
    // io: socket.io instance (or null)

    console.log('Server connecting to RethinkDB')

    failedAttempts = failedAttempts || 0;
    var rdbConnection;

    // Create a connection to RethinkDB
    r.connect({
        config.rethinkdb.host,
        port: config.rethinkdb.port,
        db: config.rethinkdb.db,
        authKey: config.rethinkdb.authKey
    }).then(function(connection) {

        rdbConnection = connection;

        // If the connection was closed for some reason (if the database is killed for example)
        // We just try to restart the server with a delay
        connection.on('close', function() {
            console.error("The connection for the feed was closed.");
            return setTimeout(function() {
                failedAttempts++;
                listen(alldata, server, failedAttempts, io);
            }, failedAttempts*delay)
        });

        return r.db('examples').table('benford').run(rdbConnection);
    }).then(function(cursor) {
        return new Promise(function(resolve, reject) {
            cursor.each(function(err, row) { // Callback for each row
                if (err) {
                    reject(new Error("Error while retrieving data the first time", err));
                }
                alldata[row.id] = row.value;
            }, function() { // Callback when all the data was retrieved from the cursor

                if (io == null) io = require('socket.io')(server);

                // Everytime a client connect to the server, we send him all the data we have
                io.on('connection', function(socket) {
                    socket.emit('all', alldata);
                })
                io.on('connect', function(socket) {
                    socket.emit('all', alldata);
                })

                // Open a feed to listen to the changes on the database
                return r.db('examples').table('benford').changes().run(rdbConnection).then(resolve).error(reject);
            });
        });
    }).then(function(feed) {
        feed.on('data', function(change) {
            // Update alldata with the new value
            alldata[change.new_val.id] = change.new_val.value; 

            // Broadcast the change to all the sockets
            io.sockets.emit('update', change);
        });

        feed.on('error', function(err) {
            if (err) {
                console.error(err.message);
                return setTimeout(function() {
                    failedAttempts++;
                    listen(alldata, server, failedAttempts, io);
                }, failedAttempts*delay)
            }
        });

    }).error(function(err) {
        console.error(err.message);
        return setTimeout(function() {
            failedAttempts++;
            listen(alldata, server, failedAttempts, io);
        }, failedAttempts*delay)
    });
}
