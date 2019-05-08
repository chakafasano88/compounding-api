function postedBy(parent, args, context) {
  return context.db.mutation.post({ id: parent.id }).postedBy()
}

function votes(parent, args, context) {
  return context.db.query.post({ id: parent.id }).votes()
}

module.exports = {
  postedBy,
  votes
}

