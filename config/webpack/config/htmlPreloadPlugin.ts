import HtmlWebpackPlugin from 'html-webpack-plugin'
import webpack from 'webpack'

/** An `import()` or `new Worker` site: its module's path suffix and specifier */
export interface ChunkOrigin {
  issuer: string
  request?: string
}

const name = 'HtmlPreloadPlugin'

/**
 * Preloads the chunks behind the named sites from the HTML, so they download
 * beside the entry script instead of a round trip after it has run. webpack's
 * own `webpackPreload` cannot do this for a child of the entry chunk.
 */
export class HtmlPreloadPlugin {
  origins: ChunkOrigin[]

  constructor(origins: ChunkOrigin[]) {
    this.origins = origins
  }

  apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(name, compilation => {
      HtmlWebpackPlugin.getCompilationHooks(
        compilation,
      ).alterAssetTagGroups.tap(name, data => {
        const files = new Set<string>()
        for (const { issuer, request } of this.origins) {
          const groups = compilation.chunkGroups.filter(group =>
            group.origins.some(
              origin =>
                (request === undefined || origin.request === request) &&
                origin.module instanceof webpack.NormalModule &&
                origin.module.resource.endsWith(issuer),
            ),
          )
          if (!groups.length) {
            compilation.errors.push(
              new webpack.WebpackError(
                `${name}: no chunk group for ${issuer} ${request ?? ''}`,
              ),
            )
          }
          for (const group of groups) {
            for (const file of group.getFiles()) {
              files.add(file)
            }
          }
        }
        const loaded = new Set(
          [...compilation.entrypoints.values()].flatMap(e => e.getFiles()),
        )
        for (const file of files) {
          if (!loaded.has(file) && /\.(js|css)$/.test(file)) {
            data.headTags.push(
              HtmlWebpackPlugin.createHtmlTagObject('link', {
                rel: 'preload',
                as: file.endsWith('.css') ? 'style' : 'script',
                href: data.publicPath + file,
              }),
            )
          }
        }
        return data
      })
    })
  }
}
