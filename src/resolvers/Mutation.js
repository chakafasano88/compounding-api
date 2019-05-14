const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { promisify } = require('util');
const { randomBytes } = require('crypto');
const { getUserId } = require('../utils')
const { transport, createEmail } = require('../mail');

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

  async requestReset(parents, args, ctx, info){
    const user = await ctx.db.query.user({ where: { email: args.email } });

    if (!user) {
      throw new Error(`No such user found for email ${args.email}`);
    }

    const randomBytesPromiseified = promisify(randomBytes);
    const resetToken = (await randomBytesPromiseified(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry },
    });

    const mailRes = await transport.sendMail({
      from: 'support@focusgroup.com',
      to: user.email,
      subject: 'Your Password Reset Token',
      html: createEmail(`Your Password Reset Token is here!
      \n\n
      <a href="${process.env.FRONTEND_URL}/forgot?resetToken=${resetToken}">Click Here to Reset</a>`),
    });

    return { message: 'Thanks!' };
  },

  async resetPassword(parent, args, ctx, info) {
    if(args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match!')
    }

    const [user] = ctx.db.query.users({ 
      where: { 
        resetToken: args.resetToken, 
        resetTokenExpiry_gte: Date.now - 3600000 } 
      });

      if(!user) {
        throw new Error('This token is either invalid or expired');
      }

      const password = await bcrpty.hash(args.password, 10);

      const updatedUsser = await ctx.db.mutation.updateUser({
        where: user.email,
        data: { password, resetToken: null, resetTokenExpiry: null }
      })

      const token = jwt.sign({ user_id: uodatedUser.id }, process.env.APP_SECRET);

      ctx.response.cookie('token', token, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365,
      });

      return updatedUsser;
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


