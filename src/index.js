const { GraphQLServer } = require('graphql-yoga')
const { prisma } = require('./generated/prisma-client')
const User = require('./resolvers/User')
const Post = require('./resolvers/Post')
const Subscription = require('./resolvers/Subscription')
const Vote = require('./resolvers/Vote')
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

// // decode the JWT so we can get the user Id on each request
server.express.use((req, res, next) => {
  const { token } = req.cookies;
  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the userId onto the req for future requests to access
    req.userId = userId;
  }
  next();
});

// // 2. Create a middleware that populates the user on each request
server.express.use(async (req, res, next) => {
  // if they aren't logged in, skip this
  if (!req.userId) return next();
  const user = await db.query.user({ where: { id: req.userId } },
    '{ id, permissions, email, name }');
   
  
  req.user = user;
  next();
});

server.use(bodyParser.json({limit: '50mb'}));
server.use(bodyParser.urlencoded({limit: "50mb", extended: true, parameterLimit:50000}));

server.start({
  cors: {
    credentials: true,
    origin: process.env.FRONTEND_URL
  }
},
  (details) => console.log(`Server is running on http://localhost:${details.port}`)
)
