function posts(parent, args, context) {
    return context.db.user.user({ id: parent.id }).posts()
}
  
  module.exports = {
    posts
  }
  