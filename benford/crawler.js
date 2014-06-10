var Twit = require('twit')
var T = new Twit({
    consumer_key: 'r2eR5pWc6DP06NVDjwfDQ',
    consumer_secret: 'djYP7ZhSnUPhJ0plWq26El2gz3RotF2MXB22xPGhBs',
    access_token: '219926305-I7oDK6kp1d91Xt6VtLTSNBtMzv0ms04LVe2uBD3b',
    access_token_secret: 'eknwEizaZAtbB3Bv5UnOimixXgFeFJPYX5IB2X5vhy1iL',
});
var r = require('rethinkdb');

var data;
var connection;

r.connect({}, function(err, conn) {
    if (err) {
        throw new Error("Could not open a connection to rethinkdb\n"+err.message)
    }
    connection = conn;

    r.dbCreate('examples').run(connection, function(err, result) {
        r.db('examples').tableCreate('benford').run(connection, function(err, result) {

            var seeds = [];
            for(var i=1; i<10; i++) {
                seeds.push({id: ""+i, value: 0});
            }
            r.db('examples').table('benford').insert(seeds).run(connection, function(err, result) {
                // If the database was already initialized, the inserts will not be executed since RethinkDB
                // does not allow redundant primary keys
                retrieve();
            });
        });
    });
});

function retrieve() {
    r.db('examples').table('benford').map(function(doc) {
        return r.object(doc("id"), doc("value"))
    }).reduce(function(left, right) {
        return left.merge(right)
    }).run(connection, function(err, result) { 
        data = result;
        listen();
    });
};

function listen() {
    var stream = T.stream('statuses/sample')

    stream.on('tweet', function (tweet) {
        var words = tweet.text.split(/\s+/);
        for(var i=0; i<words.length; i++) {
            if (words[i].match(/^[1-9]/) !== null) {
                r.db('examples').table('benford').get(words[i][0]).update({value: r.row("value").add(1)}).run(connection, {noreply: true})
            }
        }
    });
}
