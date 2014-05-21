// Import express and co
var express = require('express');
var bodyParser = require('body-parser');
var app = express();

// Load config for RethinkDB and express
var config = require(__dirname+"/config.js")

var r = require('rethinkdb');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser());

// Middleware that will create a connection to the database
app.use('/todo', createConnection);

// Define main routes
app.route('/todo/get').get(get);
app.route('/todo/new').put(create);
app.route('/todo/update').post(update);
app.route('/todo/delete').post(del);

// Middleware to close a connection to the database
app.use('/todo', closeConnection);


/*
 * Retrieve all todos
 */
function get(req, res, next) {
    r.table('todos').orderBy({index: "createdAt"}).run(req._rdbConn, function(error, cursor) {
        if (error) {
            handleError(res, error) 
        }
        else {
            // Retrieve all the todos in an array
            cursor.toArray(function(error, result) {
                if (error) {
                    handleError(res, error) 
                }
                else {
                    res.send(JSON.stringify(result));
                }
            });
        }
        next();
    });
}

/*
 * Insert a todo
 */
function create(req, res, next) {
    var todo = req.body;
    todo.createdAt = r.now(); // Set the field `createdAt` to the current time

    r.table('todos').insert(todo, {returnVals: true}).run(req._rdbConn, function(error, result) {
        if (error) {
            handleError(res, error) 
        }
        else if (result.inserted !== 1) {
            handleError(res, new Error("Document was not inserted.")) 
        }
        else {
            res.send(JSON.stringify(result.new_val));
        }
        next();
    });
}

/*
 * Update a todo
 */
function update(req, res, next) {
    var todo = req.body;
    if ((todo != null) && (todo.id != null)) {
        r.table('todos').get(todo.id).update(todo, {returnVals: true}).run(req._rdbConn, function(error, result) {
            if (error) {
                handleError(res, error) 
            }
            else {
                res.send(JSON.stringify(result.new_val));
            }
            next();
        });
    }
    else {
        handleError(res, new Error("The todo must have a field `id`."))
        next();
    }
}

/*
 * Delete a todo
 */
function del(req, res, next) {
    var todo = req.body;
    if ((todo != null) && (todo.id != null)) {
        r.table('todos').get(todo.id).delete().run(req._rdbConn, function(error, result) {
            if (error) {
                handleError(res, error) 
            }
            else {
                res.send(JSON.stringify(result));
            }
            next();
        });
    }
    else {
        handleError(res, new Error("The todo must have a field `id`."))
        next();
    }
}

/*
 * Send back a 500 error
 */
function handleError(res, error) {
    return res.send(500, {error: error.message});
}

/*
 * Create a RethinkDB connection, and save it in req._rdbConn
 */
function createConnection(req, res, next) {
    r.connect(config.rethinkdb, function(error, conn) {
        if (error) {
            handleError(res, error);
        }
        else {
            req._rdbConn = conn;
            next();
        }
    });
}

/*
 * Close the RethinkDB connection
 */
function closeConnection(req, res, next) {
    req._rdbConn.close();
}

/*
 * Create tables/indexes then start express
 */
r.connect(config.rethinkdb, function(err, conn) {
    if (err) {
        console.log("Could not open a connection to initialize the database");
        console.log(err.message);
        process.exit(1);
    }
    r.table('todos').indexWait('createdAt').run(conn, function(err, result) {
        if (err) {
            // The database/table/index was not available, create them

            r.dbCreate(config.rethinkdb.db).run(conn, function(err, result) {
                if ((err) && (!err.message.match(/Database `.*` already exists/))) {
                    console.log("Could not create the database `"+config.db+"`");
                    console.log(err);
                    process.exit(1);
                }
                console.log('Database `'+config.rethinkdb.db+'` created.');

                r.tableCreate('todos').run(conn, function(err, result) {
                    if ((err) && (!err.message.match(/Table `.*` already exists/))) {
                        console.log("Could not create the table `todos`");
                        console.log(err);
                        process.exit(1);
                    }
                    console.log('Table `todos` created.');

                    r.table('todos').indexCreate('createdAt').run(conn, function(err, result) {
                        if ((err) && (!err.message.match(/Index `.*` already exists/))) {
                            console.log("Could not create the index `todos`");
                            console.log(err);
                            process.exit(1);
                        }

                        console.log('Index `createdAt` created.');

                        r.table('todos').indexWait('createdAt').run(conn, function(err, result) {
                            if (err) {
                                console.log("Could not wait for the completion of the index `todos`");
                                console.log(err);
                                process.exit(1);
                            }
                            console.log('Index `createdAt` ready.');
                            console.log("Table and index are available, starting express...");

                            startExpress();
                            conn.close();
                        });
                    });
                });
            });
        }
        else {
            console.log("Table and index are available, starting express...");
            startExpress();
        }
    });

});

function startExpress() {
    app.listen(config.express.port);
    console.log('Listening on port '+config.express.port);
}
