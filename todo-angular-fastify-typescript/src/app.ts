import r from 'rethinkdb';
import Fastify from 'fastify'
import path from 'path'
import MyApp from './MyApp'
import fastify_static from 'fastify-static'
import config from './config'

const app:MyApp = Fastify({ logger: true })
//For serving the index.html and all the other front-end assets.
app.register(fastify_static, {root: path.join(__dirname, '../public')});

//The REST routes for "todos".
app.get('/todos', (request, reply) => {
  r.table('todos').orderBy({index: 'createdAt'})
  .run(app._rdbConn, (err: any, cursor: any) => {
    if(err) reply.send(err);
    //Retrieve all the todos in an array.
    cursor.toArray((err: any, result: any) => {
      if(err) reply.send(err);
      reply.send(result);
    });
  });
})
app.post('/todos', (request, reply) => {
  const todoItem = request.body;
  todoItem.createdAt = r.now();
  console.dir(todoItem);
  r.table('todos')
  .insert(todoItem, {returnChanges: true})
  .run(app._rdbConn, (err: any, result: any) => {
    if(err) reply.send(err);
    else reply.send(result.changes[0].new_val);
  });
});

app.get('/todos/:id', (request, reply) => {
  const todoItemID = request.params.id;
  r.table('todos').get(todoItemID).run(app._rdbConn, (err: any, result: any) => {
    if(err) reply.send(err);
    else reply.send(result);
  });
});
app.put('/todos/:id', (request, reply) => {
  const todoItem = request.body;
  const todoItemID = request.params.id;
  r.table('todos')
  .get(todoItemID)
  .update(todoItem, {returnChanges: true})
  .run(app._rdbConn, (err: any, result:any) => {
    if(err) reply.send(err);
    else reply.send(result.changes[0].new_val);
  });
});
app.delete('/todos/:id', (request, reply) => {
  const todoItemID = request.params.id;
  r.table('todos')
  .get(todoItemID)
  .delete()
  .run(app._rdbConn, (err:any, result:any) => {
    if(err) reply.send(err);
    else reply.send({success: true});
  });
});

// If we reach this, the route could not be handled and must be unknown.
app.setNotFoundHandler(function (request, reply) {
  reply
    .code(404)
    .type('text/plain')
    .send('not found')
})

/*
 * Generic error handling.
 * Send back a 500 page and log the error to the console.
 */
app.setErrorHandler(async (error, req, reply) => {
  console.log('MAIN ERROR HANDLER')
  reply.status(500)
  reply.send()
})

/*
 * Store the db connection and start listening on a port.
 */
function startServer(connection: any) {
  app._rdbConn = connection;
  app.listen(config.http.port)
  .catch(
    (err) => {
      app.log.error(err);
      connection.close();
      process.exit(1);
    }
  );
}

/*
 * Connect to rethinkdb, create the needed tables/indexes and then start http server.
 * Create tables/indexes then start http server
 */
r.connect(config.rethinkdb, (err, conn) => {
  if (err) {
    console.log("Could not open a connection to initialize the database");
    console.log(err.message);
    process.exit(1);
  }
  r.table('todos')
  .indexWait('createdAt')
  .run(conn)
  .then(() => {
    console.log("Table and index are available, starting http server...");
    startServer(conn);
  }).catch((err) => {
    // The database/table/index was not available, create them
    r.dbCreate(config.rethinkdb.db)
    .run(conn)
    .finally(() => {
      return r.db(config.rethinkdb.db).tableCreate('todos').run(conn);
    }).finally(() => {
      r.table('todos').indexCreate('createdAt').run(conn);
    }).finally(() => {
      r.table('todos').indexWait('createdAt').run(conn);
    }).then((result) => {
      console.log("Table and index are available, starting http server...");
      startServer(conn);
    }).catch((err) => {
      if (err) {
        console.log("Could not wait for the completion of the index `todos`");
        console.log(err);
        process.exit(1);
      }
    });
  });
});