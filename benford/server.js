var config = require(__dirname+"/config.js");

var express = require('express');
var r = require('rethinkdb');

var cluster = require('cluster');
var numCPUs = require('os').cpus().length;

var sticky = require('sticky-session');


// We do not use directly the `cluster` modules because socket.io won't work
// sticky will use the request's ip such that a client always connect to the same server
sticky(function() {
    var app = express();

    // Serve static content
    app.use(express.static(__dirname + '/public'));

    var server = require('http').createServer(app);
    var io = require('socket.io')(server);

    // Initialize the values for each significant digits with what we have in the database
    var alldata = {};
    r.connect({}, function(err, connection) {
        r.db('examples').table('benford').run(connection, function(err, cursor) {
            if (err) throw new Error("Could not retrieve the data from the server. Is `crawler.js` running?")

            cursor.each(function(err, row) {
                alldata[row.id] = row.value;
            });
        });
    });

    // Everytime a client connect to the server, we send him all the data we have
    io.on('connection', function(socket) {
        socket.emit('all', alldata);
    })

    // Create a connection to RethinkDB
    r.connect({
        host: config.rethinkdb.host,
        port: config.rethinkdb.port,
        db: config.rethinkdb.db
    }, function(err, connection) {

        // Open a feed to listen to the changes on the database
        r.db('examples').table('benford').changes().run(connection, function(err, feed) {

            feed.on('data', function(change) {
                // Broadcast the change to all the sockets
                io.sockets.emit('update', change.new_val);

                // Update alldata with the new value
                alldata[change.new_val.id] = change.new_val.value; 
            });
        });
    });

    return server;
}).listen(config.http.port, function() {
    console.log('Server listenening at port %d', config.http.port)
});
