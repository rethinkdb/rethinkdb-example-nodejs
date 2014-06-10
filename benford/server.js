var express = require('express');
var app = express();
var r = require('rethinkdb');


var server = require('http').createServer(app);
var io = require('socket.io')(server);

var port = 3000;


server.listen(port, function() {
    console.log('Server listenening at port %d', port)
});


app.use(express.static(__dirname + '/public'));

var sockets = [];

var data = [];
r.connect({}, function(err, connection) {
    r.db('examples').table('benford').run(connection, function(err, cursor) {
        cursor.each(function(err, row) {
            data.push(row)
        });
    });
});

io.on('connection', function(socket) {
    console.log('New connection');
    socket.emit('all', data);
})


r.connect({}, function(err, connection) {
    r.db('examples').table('benford').changes().run(connection, function(err, feed) {
        feed.each(function(err, change) {
            io.sockets.emit('update', change);
        });
    });
});
