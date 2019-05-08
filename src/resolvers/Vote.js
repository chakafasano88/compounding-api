function post(parent, args, context) {
    return context.db.vote.vote({ id: parent.id }).post()
  }
  
  function user(parent, args, context) {
    return context.db.vote.vote({ id: parent.id }).user()
  }
  
  module.exports = {
    post,
    user
  }
  