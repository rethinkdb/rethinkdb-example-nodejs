var koa = require('koa');

// Middleware and helpers
var serve = require('koa-static');
var parse = require('co-body');
var router = require('koa-router');
var http = require('http');

// Import rethinkdb
var r = require('rethinkdb');

// Load config for RethinkDB and koa
var config = require(__dirname+"/config.js");

var app = koa();

// Static content
app.use(serve(__dirname+'/public'));

// Create a RethinkDB connection
app.use(createConnection);

app.use(router(app));
app.get('/todo/get', get);
app.put('/todo/new', create);
app.post('/todo/update', update);
app.post('/todo/delete', del);

// Close the RethinkDB connection
app.use(closeConnection);

/*
 * Create a RethinkDB connection, and save it in req._rdbConn
 */
function* createConnection(next) {
    try{
        var conn = yield r.connect(config.rethinkdb);
        this._rdbConn = conn;
    }
    catch(err) {
        this.status = 500;
        this.body = err.message || http.STATUS_CODES[this.status];
    }
    yield next;
}

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
    yield next;
}

// Create a new todo
function* create(next) {
    try{
        var todo = yield parse(this);
        todo.createdAt = r.now(); // Set the field `createdAt` to the current time
        var result = yield r.table('todos').insert(todo, {returnVals: true}).run(this._rdbConn);

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

        var result = yield r.table('todos').get(todo.id).update(todo, {returnVals: true}).run(this._rdbConn);
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
 * Close the RethinkDB connection
 */
function* closeConnection(next) {
    this._rdbConn.close();
}

r.connect(config.rethinkdb, function(err, conn) {
    if (err) {
        console.log("Could not open a connection to initialize the database");
        console.log(err.message);
        process.exit(1);
    }

    r.table('todos').indexWait('createdAt').run(conn).then(function(err, result) {
        console.log("Table and index are available, starting koa...");
        startKoa();
    }).error(function(err) {
        // The database/table/index was not available, create them
        r.dbCreate(config.rethinkdb.db).run(conn).finally(function() {
            return r.tableCreate('todos').run(conn)
        }).finally(function() {
            r.table('todos').indexCreate('createdAt').run(conn);
        }).finally(function(result) {
            r.table('todos').indexWait('createdAt').run(conn)
        }).then(function(result) {
            console.log("Table and index are available, starting koa...");
            startKoa();
            conn.close();
        }).error(function(err) {
            if (err) {
                console.log("Could not wait for the completion of the index `todos`");
                console.log(err);
                process.exit(1);
            }
            console.log("Table and index are available, starting koa...");
            startKoa();
            conn.close();
        });
    });
});


function startKoa() {
    app.listen(config.koa.port);
    console.log('Listening on port '+config.koa.port);
}
