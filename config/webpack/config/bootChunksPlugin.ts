import HtmlWebpackPlugin from 'html-webpack-plugin'
import webpack from 'webpack'

/** An `import()` or `new Worker` site: its module's path suffix and specifier */
export interface ChunkOrigin {
  issuer: string
  request?: string
}

const name = 'BootChunksPlugin'

/**
 * V8 compiles every function of a script carrying this first line eagerly, on
 * a background thread while the file streams in, instead of lazily on the main
 * thread when each is first called. Only for chunks a cold load runs nearly
 * whole: on lazy chunks the extra compile costs a repeat visit more than it
 * saves (agent-docs/reference/COLD_LOAD_PROFILE.md).
 */
const COMPILE_HINT = '//# allFunctionsCalledOnLoad\n'

/**
 * The chunks every cold load runs: the entry's, and those behind the named
 * sites. The HTML preloads the latter, so they download beside the entry
 * script instead of a round trip after it has run (webpack's own
 * `webpackPreload` cannot do this for a child of the entry chunk), and every
 * one of them is marked for eager compilation.
 */
export class BootChunksPlugin {
  origins: ChunkOrigin[]

  listed: Record<string, ChunkOrigin[]>

  /**
   * `listed` names chunk groups only some loads run: the HTML lists each
   * group's script files in a JSON `<script>` under its id, for the page to
   * preload once it knows it needs them
   */
  constructor(
    origins: ChunkOrigin[],
    listed: Record<string, ChunkOrigin[]> = {},
  ) {
    this.origins = origins
    this.listed = listed
  }

  originFiles(compilation: webpack.Compilation, origins = this.origins) {
    const files = new Set<string>()
    for (const { issuer, request } of origins) {
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
    return files
  }

  apply(compiler: webpack.Compiler) {
    const { ConcatSource } = compiler.webpack.sources
    compiler.hooks.thisCompilation.tap(name, compilation => {
      const entryFiles = () =>
        new Set(
          [...compilation.entrypoints.values()].flatMap(e => e.getFiles()),
        )
      let bootFiles = new Set<string>()

      // after minification, so the hint precedes the license banner, and
      // before source maps and content hashes are computed over the result
      compilation.hooks.processAssets.tap(
        {
          name,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1,
        },
        () => {
          bootFiles = this.originFiles(compilation)
          for (const file of [...entryFiles(), ...bootFiles]) {
            if (file.endsWith('.js')) {
              compilation.updateAsset(
                file,
                source => new ConcatSource(COMPILE_HINT, source),
              )
            }
          }
        },
      )

      HtmlWebpackPlugin.getCompilationHooks(
        compilation,
      ).alterAssetTagGroups.tap(name, data => {
        const loaded = entryFiles()
        for (const file of bootFiles) {
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
        for (const [id, origins] of Object.entries(this.listed)) {
          const scripts = [...this.originFiles(compilation, origins)]
            .filter(file => file.endsWith('.js') && !loaded.has(file))
            .map(file => data.publicPath + file)
          data.headTags.push(
            HtmlWebpackPlugin.createHtmlTagObject(
              'script',
              { type: 'application/json', id },
              JSON.stringify(scripts),
            ),
          )
        }
        return data
      })
    })
  }
}
