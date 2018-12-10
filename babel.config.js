module.exports = api => {
  api.cache(false)
  return {
    babelrcRoots: ['.', './packages/*'],
  }
}
