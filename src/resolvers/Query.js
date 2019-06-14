const { forwardTo } = require('prisma-binding');

const Query = {
  posts: forwardTo('db'),
  post: forwardTo('db'),
  
  async feed(parent, args, context, info) {
    const where = args.filter ? {
      OR: [
        { description_contains: args.filter },
        { url_contains: args.filter },
      ],
    } : {}
  
    const posts = await context.db.posts({
      where,
      skip: args.skip,
      first: args.first,
      orderBy: args.orderBy
    })
  
    const count = await context.db.query.postsConnection({
      where,
    }).aggregate().count()
  
    return { 
      posts,  
      count
    }
  },
  
  async me(parent, args, ctx, info) {
    if(!ctx.request.userId){
      return null;
    }

    const user = await ctx.db.query.user({where: { id: ctx.request.userId }}, info);

    return user
  },

  async users(parent, args, ctx, info) {
    // 1. Check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!');
    }
    
    const users = await ctx.db.query.users({}, info);
    
    return users.filter(user => user.id !== ctx.request.userId)
  },
  
  async posts(parent, args, ctx, info) {
    const where = args.filter ? {
      OR: [
        { types: args.filter },
      ],
    } : {}

    const posts = await ctx.db.query.posts(where, info);

    if(!posts) {
      throw new Error('Error getting posts.');
    }

    return posts.filter((post, i) => (post.types[0] === args.filter));
  },
  
  async post(parent, args, ctx, info) {
    const post = await ctx.db.query.post({ where: { id: args.where.id }}, info);
    
    return post;
  },

  async vote(parent, args, ctx, info) {
    const vote = await ctx.db.query.vote({ where: { id: args.where.id }}, info);
    
    return vote;
  }

}

module.exports = Query;