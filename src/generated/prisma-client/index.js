"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var prisma_lib_1 = require("prisma-client-lib");
var typeDefs = require("./prisma-schema").typeDefs;

var models = [
  {
    name: "Permission",
    embedded: false
  },
  {
    name: "PostTypes",
    embedded: false
  },
  {
    name: "Post",
    embedded: false
  },
  {
    name: "User",
    embedded: false
  },
  {
    name: "Vote",
    embedded: false
  }
];
exports.Prisma = prisma_lib_1.makePrismaClientClass({
  typeDefs,
  models,
  endpoint: `https://eu1.prisma.sh/matthew-fasano-c62c3d/compounding/dev`,
  secret: `asdhaisdhviaosceoaoui321403hvqe0w`
});
exports.prisma = new exports.Prisma();
