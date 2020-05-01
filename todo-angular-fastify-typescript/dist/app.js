"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var rethinkdb_1 = __importDefault(require("rethinkdb"));
var fastify_1 = __importDefault(require("fastify"));
var path_1 = __importDefault(require("path"));
var fastify_static_1 = __importDefault(require("fastify-static"));
var config_1 = __importDefault(require("./config"));
var app = fastify_1.default({ logger: true });
app.register(fastify_static_1.default, { root: path_1.default.join(__dirname, '../public') });
app.get('/todos', function (request, reply) {
    rethinkdb_1.default.table('todos').orderBy({ index: 'createdAt' })
        .run(app._rdbConn, function (err, cursor) {
        if (err)
            reply.send(err);
        cursor.toArray(function (err, result) {
            if (err)
                reply.send(err);
            reply.send(result);
        });
    });
});
app.post('/todos', function (request, reply) {
    var todoItem = request.body;
    todoItem.createdAt = rethinkdb_1.default.now();
    console.dir(todoItem);
    rethinkdb_1.default.table('todos')
        .insert(todoItem, { returnChanges: true })
        .run(app._rdbConn, function (err, result) {
        if (err)
            reply.send(err);
        else
            reply.send(result.changes[0].new_val);
    });
});
app.get('/todos/:id', function (request, reply) {
    var todoItemID = request.params.id;
    rethinkdb_1.default.table('todos').get(todoItemID).run(app._rdbConn, function (err, result) {
        if (err)
            reply.send(err);
        else
            reply.send(result);
    });
});
app.put('/todos/:id', function (request, reply) {
    var todoItem = request.body;
    var todoItemID = request.params.id;
    rethinkdb_1.default.table('todos')
        .get(todoItemID)
        .update(todoItem, { returnChanges: true })
        .run(app._rdbConn, function (err, result) {
        if (err)
            reply.send(err);
        else
            reply.send(result.changes[0].new_val);
    });
});
app.delete('/todos/:id', function (request, reply) {
    var todoItemID = request.params.id;
    rethinkdb_1.default.table('todos')
        .get(todoItemID)
        .delete()
        .run(app._rdbConn, function (err, result) {
        if (err)
            reply.send(err);
        else
            reply.send({ success: true });
    });
});
app.setNotFoundHandler(function (request, reply) {
    reply
        .code(404)
        .type('text/plain')
        .send('not found');
});
app.setErrorHandler(function (error, req, reply) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        console.log('MAIN ERROR HANDLER');
        reply.status(500);
        reply.send();
        return [2];
    });
}); });
function startServer(connection) {
    app._rdbConn = connection;
    app.listen(config_1.default.http.port)
        .catch(function (err) {
        app.log.error(err);
        connection.close();
        process.exit(1);
    });
}
rethinkdb_1.default.connect(config_1.default.rethinkdb, function (err, conn) {
    if (err) {
        console.log("Could not open a connection to initialize the database");
        console.log(err.message);
        process.exit(1);
    }
    rethinkdb_1.default.table('todos')
        .indexWait('createdAt')
        .run(conn)
        .then(function () {
        console.log("Table and index are available, starting http server...");
        startServer(conn);
    }).catch(function (err) {
        rethinkdb_1.default.dbCreate(config_1.default.rethinkdb.db)
            .run(conn)
            .finally(function () {
            return rethinkdb_1.default.db(config_1.default.rethinkdb.db).tableCreate('todos').run(conn);
        }).finally(function () {
            rethinkdb_1.default.table('todos').indexCreate('createdAt').run(conn);
        }).finally(function () {
            rethinkdb_1.default.table('todos').indexWait('createdAt').run(conn);
        }).then(function (result) {
            console.log("Table and index are available, starting http server...");
            startServer(conn);
        }).catch(function (err) {
            if (err) {
                console.log("Could not wait for the completion of the index `todos`");
                console.log(err);
                process.exit(1);
            }
        });
    });
});
