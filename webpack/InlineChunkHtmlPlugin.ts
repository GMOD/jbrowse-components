import type { Compiler } from 'webpack'

export default class InlineChunkHtmlPlugin {
  htmlWebpackPlugin: {
    getHooks: (compilation: unknown) => {
      alterAssetTagGroups: {
        tap: (
          name: string,
          cb: (assets: { headTags: unknown[]; bodyTags: unknown[] }) => void,
        ) => void
      }
    }
  }
  tests: RegExp[]

  constructor(
    htmlWebpackPlugin: InlineChunkHtmlPlugin['htmlWebpackPlugin'],
    tests: RegExp[],
  ) {
    this.htmlWebpackPlugin = htmlWebpackPlugin
    this.tests = tests
  }

  getInlinedTag(
    publicPath: string,
    assets: Record<string, { source: () => string }>,
    tag: {
      tagName: string
      attributes?: { src?: string }
      innerHTML?: string
      closeTag?: boolean
    },
  ) {
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

  apply(compiler: Compiler) {
    let publicPath = (compiler.options.output.publicPath || '') as string
    if (publicPath && !publicPath.endsWith('/')) {
      publicPath += '/'
    }

    compiler.hooks.compilation.tap('InlineChunkHtmlPlugin', compilation => {
      const tagFunction = (
        tag: Parameters<InlineChunkHtmlPlugin['getInlinedTag']>[2],
      ) =>
        this.getInlinedTag(
          publicPath,
          compilation.assets as Record<string, { source: () => string }>,
          tag,
        )

      const hooks = this.htmlWebpackPlugin.getHooks(compilation)
      hooks.alterAssetTagGroups.tap('InlineChunkHtmlPlugin', assets => {
        type Tag = Parameters<InlineChunkHtmlPlugin['getInlinedTag']>[2]
        assets.headTags = (assets.headTags as Tag[]).map(tagFunction)
        assets.bodyTags = (assets.bodyTags as Tag[]).map(tagFunction)
      })
    })
  }
}
