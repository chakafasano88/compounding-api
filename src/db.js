// This file connects to the remote prisma DB and gives us the ability to query it with JS
const { Prisma } = require('prisma-binding');

const db = new Prisma({
  typeDefs: 'src/generated/prisma.graphql',
  endpoint: process.env.PRISMA_ENDPOINT,
  secret: 'asdhaisdhviaosceoaoui321403hvqe0w',
  // secret: process.env.PRISMA_SECRET,
  debug: false,
});

module.exports = db;
