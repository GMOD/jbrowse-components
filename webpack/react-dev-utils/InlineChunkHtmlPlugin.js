export default class InlineChunkHtmlPlugin {
  constructor(htmlWebpackPlugin, tests) {
    this.htmlWebpackPlugin = htmlWebpackPlugin
    this.tests = tests
  }

  getInlinedTag(publicPath, assets, tag) {
    if (tag.tagName !== 'script' || !tag.attributes?.src) {
      return tag
    }
    const scriptName = publicPath
      ? tag.attributes.src.replace(publicPath, '')
      : tag.attributes.src
    if (!this.tests.some(test => scriptName.match(test))) {
      return tag
    }
    const asset = assets[scriptName]
    if (asset == null) {
      return tag
    }
    return { tagName: 'script', innerHTML: asset.source(), closeTag: true }
  }

  apply(compiler) {
    let publicPath = compiler.options.output.publicPath || ''
    if (publicPath && !publicPath.endsWith('/')) {
      publicPath += '/'
    }

    compiler.hooks.compilation.tap('InlineChunkHtmlPlugin', compilation => {
      const tagFunction = tag =>
        this.getInlinedTag(publicPath, compilation.assets, tag)

      const hooks = this.htmlWebpackPlugin.getHooks(compilation)
      hooks.alterAssetTagGroups.tap('InlineChunkHtmlPlugin', assets => {
        assets.headTags = assets.headTags.map(tagFunction)
        assets.bodyTags = assets.bodyTags.map(tagFunction)
      })
    })
  }
}
