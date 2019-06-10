const { GraphQLServer } = require('graphql-yoga')
const { prisma } = require('./generated/prisma-client')
require('dotenv').config({ path: 'variables.env' })
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken')
const db = require('./db');
const Mutation = require('./resolvers/Mutation');
const Query = require('./resolvers/Query');
const bodyParser = require('body-parser');

const resolvers = {
  Query,
  Mutation
}

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: request => {
    return {
      ...request,
      db,
    }
  },
})

server.express.use(cookieParser());

// start it
server.express.use((req, res, next) => {

  const { token } = req.cookies;

  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the userId onto the req for future requests to access
    req.userId = userId;
  }
  next();
});

// 2. Creates a middleware that populates the user on each request

server.express.use(async (req, res, next) => {
  // if they aren't logged in, skip this

  if (!req.userId) return next();
  const user = await db.query.user(
    { where: { id: req.userId } },
    '{ id, permissions, email }'
  );
  req.user = user;
  next();
});

server.start(
  {
    cors: {
      credentials: true,
      origin: process.env.FRONTEND_URL,
    },
  },
  details => {
    console.log(`Server is now running on port http://localhost:${details.port}`);
  }
);
