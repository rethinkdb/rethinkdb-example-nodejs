var koa = require('koa');

// Middleware and helpers
var serve = require('koa-static');
var parse = require('co-body');
var Router = require('koa-router');
var http = require('http');
var logger = require('koa-logger');
var co = require('co');

// Import rethinkdb
var r = require('rethinkdb');

// Load config for RethinkDB and koa
var config = require(__dirname+"/config.js");

var app = koa();

//
// MIDDLEWARE
//

// Static content
app.use(serve(__dirname+'/public'));

// Log requests
app.use(logger());

// Parse application/json bodies into this.request.body
app.use(function* (next) {
  this.request.body = yield parse.json(this);
  yield next;
});

// Create a RethinkDB connection, save it in the koa context, and ensure it closes
app.use(function* wrapConnection(next) {
    this.state.conn = yield r.connect(config.rethinkdb);
    // No matter what happens downstream, always close the connection
    try {
        yield next;
    } finally {
        this.state.conn.close();
    }
});

//
// ROUTES
//

var router = Router();

// Retrieve all todos
router.get('/todo/get', function* get(next) {
    var cursor = yield r.table('todos').orderBy({index: "createdAt"}).run(this.state.conn);
    var result = yield cursor.toArray();
    this.body = result;
})

// Create a new todo
router.put('/todo/new', function* create(next) {
    var todo = this.request.body;
    todo.createdAt = r.now(); // Set the field `createdAt` to the current time
    var result = yield r.table('todos').insert(todo, {returnChanges: true}).run(this.state.conn);

    todo = result.changes[0].new_val; // todo now contains the previous todo + a field `id` and `createdAt`
    this.body = todo;
});

// Update a todo
router.post('/todo/update', function* update(next) {
    var todo = this.request.body;
    this.assert(todo && todo.id, 400, 'todo must have field `id`');
    delete todo._saving;
    var result = yield r.table('todos').get(todo.id).update(todo, {returnChanges: true}).run(this.state.conn);
    this.body = result.changes[0].new_val;
});

// Delete a todo
router.post('/todo/delete', function* del(next) {
    var todo = this.request.body;
    this.assert(todo && todo.id, 400, 'todo must have field `id`');
    var result = yield r.table('todos').get(todo.id).delete().run(this.state.conn);
    this.body = '';
});

// Mount our router
app.use(router.routes());

// Setup database and launch the koa server
var conn;
co(function* () {
    try {
        conn = yield r.connect(config.rethinkdb);
    } catch(err) {
        console.error("Could not open a connection to initialize the database");
        throw err;
    }
    try {
        yield r.table('todos').indexWait('createdAt').run(conn);
        console.log("Table and index are available, starting koa...");
    } catch(err) {
        // The database/table/index was not available, create them
        yield r.dbCreate(config.rethinkdb.db).run(conn);
        yield r.tableCreate('todos').run(conn);
        yield r.table('todos').indexCreate('createdAt').run(conn);
        yield r.table('todos').indexWait('createdAt').run(conn)
        console.log("Table and index are available, starting koa...");
    }
}).then(function () {
    conn.close();
    app.listen(config.koa.port, function() {
      console.log('Listening on port', config.koa.port);
    });
}).catch(function (err) {
    conn.close();
    console.error(err);
    process.exit(1);
});
