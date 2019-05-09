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

// decode the JWT so we can get the user Id on each request
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
    '{ id, permissions, email, name }'
  );
  req.user = user;
  next();
});

// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", '*');
//     res.header("Access-Control-Allow-Credentials", true);
//     res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
//     res.header("Access-Control-Allow-Headers", 'Origin,X-Requested-With,Content-Type,Accept,content-type,application/json');
//     next();
// });

server.start(
  // {
  //   cors: {
  //     credentials: true,
  //     origin: "https://compounding-react-prod.herokuapp.com/",
  //   },
  // },
  details => {
    console.log(`Server is now running on port http://localhost:${details.port}`);
  }
);
