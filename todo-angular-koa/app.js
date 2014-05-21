var app = require('koa')();

// Middleware
var serve = require('koa-static');
var parse = require('co-body');
var route = require('koa-route');
var assertTimeout = require('co-assert-timeout');
var http = require('http');

// Load config for RethinkDB and koa
var config = require(__dirname+"/config.js")

// Import rethinkdbdash
var r = require('rethinkdb');

app.use(createConnection);

app.use(route.get('/todo/get', get));
app.use(route.put('/todo/new', create));
app.use(route.post('/todo/update', update));
app.use(route.post('/todo/delete', del));

app.use(closeConnection);

// Static content
app.use(serve(__dirname+'/public'));


// Retrieve all todos
function* get(next) {
    try{
        var cursor = yield r.table('todos').orderBy({index: "createdAt"}).run(this._rdbConn);
        var result = yield cursor.toArray();
        this.body = JSON.stringify(result);
    }
    catch(e) {
        this.status = 500;
        this.body = e.message || http.STATUS_CODES[this.status];
    }
    console.log(1)
    yield next;
    console.log(2)
}

// Create a new todo
function* create(next) {
    try{
        var todo = yield parse(this);
        todo.createdAt = r.now(); // Set the field `createdAt` to the current time
        var result = yield r.table(config.table).insert(todo, {returnVals: true}).run(this._rdbConn);

        todo = result.new_val; // todo now contains the previous todo + a field `id` and `createdAt`
        this.body = JSON.stringify(todo);
    }
    catch(e) {
        this.status = 500;
        this.body = e.message || http.STATUS_CODES[this.status];
    }
    yield next;
}

// Update a todo
function* update(next) {
    try{
        var todo = yield parse(this);
        delete todo._saving;
        if ((todo == null) || (todo.id == null)) {
            throw new Error("The todo must have a field `id`.");
        }

        var result = yield r.table(config.table).get(todo.id).update(todo, {returnVals: true}).run(this._rdbConn);
        this.body = JSON.stringify(result.new_val);
    }
    catch(e) {
        this.status = 500;
        this.body = e.message || http.STATUS_CODES[this.status];
    }
    yield next;
}

// Delete a todo
function* del(next) {
    try{
        var todo = yield parse(this);
        if ((todo == null) || (todo.id == null)) {
            throw new Error("The todo must have a field `id`.");
        }
        var result = yield r.table('todos').get(todo.id).delete().run(this._rdbConn);
        this.body = "";
    }
    catch(e) {
        this.status = 500;
        this.body = e.message || http.STATUS_CODES[this.status];
    }
    yield next;
}

/*
 * Create a RethinkDB connection, and save it in req._rdbConn
 */
function* createConnection(next) {
    if (this.is('/todo/*')) {
        try{
            var conn = yield r.connect(config.rethinkdb);
            this._rdbConn = conn;
        }
        catch(err) {
            this.status = 500;
            this.body = e.message || http.STATUS_CODES[this.status];
        }
    }
    yield next;
}

/*
 * Close the RethinkDB connection
 */
function* closeConnection(next) {
    if (this.is('/todo/*')) {
        req._rdbConn.close();
    }
    yield next;
}

r.connect(config.rethinkdb, function(err, conn) {
    if (err) {
        console.log("Could not open a connection to initialize the database");
        console.log(err.message);
        process.exit(1);
    }

    r.table('todos').indexWait('createdAt').run(conn).then(function(err, result) {
        console.log("Table and index are available, starting express...");
        startExpress();
    }).error(function(err) {
        // The database/table/index was not available, create them
        r.dbCreate(config.rethinkdb.db).run(conn).finally(function() {
            return r.tableCreate('todos').run(conn)
        }).finally(function() {
            r.table('todos').indexCreate('createdAt').run(conn);
        }).finally(function(result) {
            r.table('todos').indexWait('createdAt').run(conn)
        }).then(function(result) {
            console.log("Table and index are available, starting express...");
            startExpress();
            conn.close();
        }).error(function(err) {
            if (err) {
                console.log("Could not wait for the completion of the index `todos`");
                console.log(err);
                process.exit(1);
            }
            console.log("Table and index are available, starting express...");
            startExpress();
            conn.close();
        });
    });

});


function startKoa() {
    app.listen(config.koa.port);
    console.log('Listening on port '+config.koa.port);
}
