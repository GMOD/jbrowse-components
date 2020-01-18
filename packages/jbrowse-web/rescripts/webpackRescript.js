module.exports = {
  webpack: config => {
    if (config.mode === 'production') {
      const loaderListRule = config.module.rules.find(ruleObj =>
        Array.isArray(ruleObj.oneOf),
      ).oneOf
      const newLoaderListRule = loaderListRule.map(r => {
        if (r.use) {
          r.use = r.use.map(u => {
            if (u.loader && u.loader.includes('mini-css-extract-plugin'))
              return require.resolve('style-loader')
            return u
          })
        }
        return r
      })
      loaderListRule.length = 0
      loaderListRule.push(...newLoaderListRule)
    }
    return config
  },
  devServer: config => {
    config.staticOptions = { fallthrough: false }
    return config
  },
}
