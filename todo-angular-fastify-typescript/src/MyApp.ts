import Fastify from 'fastify';
export default interface MyApp extends Fastify.FastifyInstance {
  mongo?: any;
  _rdbConn?: any;
}