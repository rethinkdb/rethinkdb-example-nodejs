var config = require(__dirname+"/config.js");

var Twit = require('twit');
var T = new Twit({
    consumer_key: config.twitter.consumer_key,
    consumer_secret: config.twitter.consumer_secret,
    access_token: config.twitter.access_token,
    access_token_secret: config.twitter.access_token_secret
});

var r = require('rethinkdb');

var data;
var failedAttempts = 0;

function init() {
    r.connect({
        host: config.rethinkdb.host,
        port: config.rethinkdb.port,
        db: config.rethinkdb.db
    }, function(err, conn) {
        if (err) {
            failedAttempts++;
            console.log("Attempt: "+failedAttempts)
            console.error("Could not open a connection to rethinkdb\n"+err.message);

            return setTimeout(init, failedAttempts*5000);
        }

        // Initialize the table with first the database
        r.dbCreate(config.rethinkdb.db).run(conn, function(err, result) {
            // If the database already exists, we'll get an error here, but we'll just keep going
            r.db(config.rethinkdb.db).tableCreate('benford').run(conn, function(err, result) {
                // If the table already exists, we'll get an error here, but we'll just keep going

                var seeds = [];
                for(var i=1; i<10; i++) {
                    seeds.push({id: ""+i, value: 0}); // Note: We use the digit value as the primary key and save it as a string
                }
                r.db(config.rethinkdb.db).table('benford').insert(seeds).run(conn, function(err, result) {
                    // If the database was already initialized, the inserts will not be executed since RethinkDB
                    // does not allow redundant primary keys (`id`)
                    listen();
                });
            });
        });
    });
}


// Listen to Twitter's stream and save the significant digits occurrences that we find
function listen() {
    // Open the stream
    var stream = T.stream('statuses/sample');
    console.log("Listening on statuses/sample");

    stream.on('tweet', function (tweet) {
        var words = tweet.text.split(/\s+/); // Split a tweet on white space

        var foundSignificantDigits = false; // Whether we found a snificant digit to save
        var data = {}; // Keep track of the data to send to the database

        for(var i=0; i<words.length; i++) {
            if (words[i].match(/^-?\d*[\.,]?\d*$/) !== null) { // Check if a word is a "usual" number
                var digit = null;
                for(var position in words[i]) { // Look for the first significant digit
                    if (words[i][position].match(/[1-9]/) !== null) {
                        digit = words[i][position];
                        break;
                    }
                }
                if (digit != null) { // Check if we found a significant digit (we may not find one for "0" for example.
                    foundSignificantDigits = true; // We found at least one number

                    data[digit] = data[digit] || 0; // If data[digit] is undefined, set it to 0
                    data[digit]++
                }
            }
        }
        if (foundSignificantDigits === true) {
            for(var digit in data) {
                // Update the document by incrementing its value with data[digit]
                // Not that we fire the write without expecting an answer
                r.connect({}).then(function(conn) {
                    conn.on('error', function(err) {
                        console.error(err.message);
                    });
                    r.db(config.rethinkdb.db).table('benford').get(digit).update({value: r.row("value").add(data[digit])}).run(conn, function(err, result) {
                        if (err) {
                            if (err.message.match(/does not exist/)) {
                                return init();
                            }
                            console.error(err.message);
                        }
                        conn.close();
                    });
                }).error(function(err) {
                    console.error(err.message);
                });
            }
        }
    });
    stream.on("close", function(err) {
        console.error("Twitter's stream was closed");
        if (err) console.log(err.message);
        listen();
    });
}

init();
