const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { promisify } = require('util');
const { randomBytes } = require('crypto');
const { getUserId } = require('../utils')
const { transport, createEmail } = require('../mail');
const sgMail = require('@sendgrid/mail');


const Mutations = {

  async signup(parent, args, ctx, info) {

    if (args.confirmPassword !== args.password) {
      throw new Error('Your passwords do not match');
    }

    delete args.confirmPassword;
    args.status = 1;

    const password = await bcrypt.hash(args.password, 10);

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

    if(!user.status) {
      throw new Error('This user has not been authenticated. Please check your email for an invite.');
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

  async requestReset(parents, args, ctx, info) {
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

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const mailRes = {
      to: res.email,
      from: 'support@focusgroup',
      subject: 'Focus Group Password Reset',
      text: 'Reset Password',
      html: `<strong>Please click the link to reset you password!</strong> 
        \n\n
       <a href="${process.env.FRONTEND_URL}/forgot?resetToken=${resetToken}">Click Here to Reset</a>`,
    };


    sgMail.send(mailRes);

    return { message: 'Thanks!' };
  },

  async resetPassword(parent, args, ctx, info) {

    if (args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match!')
    }

    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now - 3600000
      }
    });

    if (!user) {
      throw new Error('This token is either invalid or expired');
    }

    const password = await bcrypt.hash(args.password, 10);

    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });

    return updatedUser;
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


  async createVote(parent, args, ctx, info) {

    if (!ctx.request.userId) {
      throw new Error(`You must have an account to do that!`)
    }

    const voteExists = await ctx.db.query.votes({ where: { post: { id: args.postId }, user: { id: ctx.request.userId } } });

    if (voteExists.length) {
      ctx.db.mutation.deleteVote({ where: { id: voteExists[0].id } });
      return;
    }

    return ctx.db.mutation.createVote({
      data: {
        user: { connect: { id: ctx.request.userId } },
        post: { connect: { id: args.postId } },
      }
    }, info)
  },

  async createComment(parent, args, ctx, info) {

    if (!ctx.request.userId) {
      throw new Error(`You must be logged in to do that!`)
    }

    return ctx.db.mutation.createComment({
      data: {
        description: args.description,
        user: { connect: { id: ctx.request.userId } },
        post: { connect: { id: args.postId } },
      }
    }, info)
  },

  async createUser(parent, args, ctx, info) {

    const userExists = await ctx.db.query.users({ where: { email: args.email }});
    
    if(userExists.length > 0) {
      throw new Error('A user with that email already exists!')
    }

    args.status = 0;

    const password = await bcrypt.hash(args.password, 10);
    const user = await ctx.db.mutation.createUser({ data: { ...args, password, permissions: { set: [args.permissions] } } });

    const randomBytesPromiseified = promisify(randomBytes);
    const inviteToken = (await randomBytesPromiseified(20)).toString('hex');
    const inviteTokenExpiry = Date.now() + 3600000; // 1 hour from now

    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { inviteToken, inviteTokenExpiry },
    });

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const mailRes = {
      to: res.email,
      from: 'support@focusgroup',
      subject: 'FocusLoop Invite',
      text: 'Reset Password',
      html: `<strong>Hello ${args.firstName}! You have been invited to be a collaborator of The FocusLoop! Click the link below to get started! Welcome to the team</strong> 
        \n\n
       <a href="${process.env.FRONTEND_URL}/invite?inviteToken=${inviteToken}">Click Here to Reset</a>`,
    };


    sgMail.send(mailRes);

    return { message: 'Thanks!' }
  },

  async connectUser(parent, args, ctx, info) {

    if (args.password !== args.confirmPassword) {
      throw new Error('Your passwords do not match!')
    }

    delete args.confirmPassword;

    const [user] = await ctx.db.query.users({
      where: {
        inviteToken: args.inviteToken,
        inviteTokenExpiry_gte: Date.now - 3600000
      }
    }, '{ id, permissions, email }');

    console.log("user", user)

    if (!user) {
      throw new Error('This token is either invalid or expired');
    }

    const password = await bcrypt.hash(args.password, 10);

    args.status = 1;

    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        ...args,
        password,
        permissions: { set: [user.permissions[0]] },
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);

    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });

    return updatedUser
  }


}

module.exports = Mutations;


