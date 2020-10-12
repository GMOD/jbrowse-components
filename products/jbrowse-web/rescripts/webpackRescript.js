module.exports = {
  devServer: config => {
    config.staticOptions = { fallthrough: false }
    return config
  },
}
