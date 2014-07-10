var config = require(__dirname+"/config.js");

var express = require('express');
var r = require('rethinkdb');
var Promise = require('bluebird');

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

var sticky = require('sticky-session');

// We do not use directly the `cluster` modules because socket.io won't work
// sticky will use the request's ip such that a client always connect to the same server
sticky(function() {
    var app = express();
    var rdbConnection, io;

    // Serve static content
    app.use(express.static(__dirname + '/public'));

    var server = require('http').createServer(app);
    var io;

    // Initialize the values for each significant digits with what we have in the database
    var alldata = {}; // digit -> occurrence

    var io;
    listen(alldata, server, 0, io)

    return server;
}).listen(config.http.port, function() {
    console.log('Server listenening at port %d', config.http.port)
});


function listen(alldata, server, failedAttempts, io) { 
    console.log('Server connecting to RethinkDB')
    failedAttempts = failedAttempts || 0;

    r.connect({}).then(function(connection) {
        rdbConnection = connection;
        // Create a connection to RethinkDB
        connection.on('close', function() {
            console.error("The connection for the feed was closed.");
            return setTimeout(function() {
                failedAttempts++;
                listen(alldata, server, failedAttempts, io);
            }, failedAttempts*5000)
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

                if (io == null) {
                    io = require('socket.io')(server);
                }

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
            // Broadcast the change to all the sockets
            io.sockets.emit('update', change);

            // Update alldata with the new value
            alldata[change.new_val.id] = change.new_val.value; 
        });
        feed.on('error', function(err) {
            if (err) {
                console.error(err.message);
                return setTimeout(function() {
                    failedAttempts++;
                    listen(alldata, server, failedAttempts, io);
                }, failedAttempts*5000)
            }
        });

    }).error(function(err) {
        console.error(err.message);
        return setTimeout(function() {
            failedAttempts++;
            listen(alldata, server, failedAttempts, io);
        }, failedAttempts*5000)
    });
}
