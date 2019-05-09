const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { getUserId } = require('../utils')

const Mutations = {

  async signup(parent, args, ctx, info) {

    const password = await bcrypt.hash(args.password, 10)

    const user = await ctx.db.mutation.createUser({ data: { ...args, password, permissions: { set: ['USER'] } } });

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)

    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });

    return { token, user }

  },

  async login(parent, args, ctx, info) {

    const user = await ctx.db.query.user({ where: { email: args.email } })
    if (!user) {
      throw new Error('No user found for the supplied email address');
    }

    const valid = await bcrypt.compare(args.password, user.password)
    if (!valid) {
      throw new Error('Invalid password')
    }
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET)

    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year cookie
    });

    return {
      token,
      user,
    }
  },

  signout(parent, args, ctx, info) {
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' };
  },

  createPost(parent, args, ctx, info) {
    // const userId = getUserId(ctx)
    if (!ctx.request.userId) {
      throw new Error('You must be logged in!');
    };

    return ctx.db.mutation.createPost({
      data: {
        url: args.url,
        description: args.description,
        title: args.title,
        types: { set: [args.types] },
        postedBy: {
          connect: { id: ctx.request.userId }
        },
      }
    }, info)
  },


  async vote(parent, args, ctx, info) {
    const userId = getUserId(ctx)

    const postExists = await ctx.db.mutation.$exists.vote({
      user: { id: userId },
      post: { id: args.postId },
    })
    if (postExists) {
      throw new Error(`Already voted for post: ${args.postId}`)
    }

    return ctx.db.mutation.createVote({
      data: {
        user: { connect: { id: userId } },
        post: { connect: { id: args.postId } },
      }
    })
  }
}

module.exports = Mutations;


