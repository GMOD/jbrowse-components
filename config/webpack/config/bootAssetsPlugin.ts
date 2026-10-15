import HtmlWebpackPlugin from 'html-webpack-plugin'
import webpack from 'webpack'

/** An `import()` or `new Worker` site: its module's path suffix and specifier */
export interface ChunkOrigin {
  issuer: string
  request?: string
}

const name = 'BootAssetsPlugin'

/**
 * V8 compiles every function of a script carrying this first line eagerly, on
 * a background thread while the file streams in, instead of lazily on the main
 * thread when each is first called. Only for chunks a cold load runs nearly
 * whole: on lazy chunks the extra compile costs a repeat visit more than it
 * saves (agent-docs/reference/COLD_LOAD_PROFILE.md).
 */
const COMPILE_HINT = '//# allFunctionsCalledOnLoad\n'

/**
 * What every cold load uses before it can draw: the entry's chunks, the chunks
 * behind the named sites, and the named font files those chunks' CSS declares.
 *
 * The HTML preloads the chunks, so they download beside the entry script
 * instead of a round trip after it has run (webpack's own `webpackPreload`
 * cannot do this for a child of the entry chunk), and every one is marked for
 * eager compilation. Each named font's `@font-face` is copied into the HTML and
 * the file preloaded, so markup painted before any script, such as the boot
 * shell, draws in the face the app will.
 */
export class BootAssetsPlugin {
  origins: ChunkOrigin[]
  fonts: string[]

  constructor(origins: ChunkOrigin[], { fonts }: { fonts: string[] }) {
    this.origins = origins
    this.fonts = fonts
  }

  originFiles(compilation: webpack.Compilation) {
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
    return files
  }

  /** Each named font's `@font-face` rules, urls resolved from the HTML */
  fontFaces(
    compilation: webpack.Compilation,
    cssFiles: string[],
    publicPath: string,
  ) {
    const faces: string[] = []
    const files = new Set<string>()
    for (const font of this.fonts) {
      const found = cssFiles.flatMap(cssFile => {
        const css = compilation.getAsset(cssFile)!.source.source().toString()
        return (css.match(/@font-face\s*{[^}]*}/g) ?? [])
          .filter(face => face.includes(`/${font}.`))
          .map(face =>
            face.replace(/url\(([^)]+)\)/g, (_, url: string) => {
              const file = new URL(url, `file:///${cssFile}`).pathname.slice(1)
              if (file.endsWith('.woff2')) {
                files.add(file)
              }
              return `url(${publicPath}${file})`
            }),
          )
      })
      if (!found.length) {
        compilation.errors.push(
          new webpack.WebpackError(`${name}: no @font-face for ${font}`),
        )
      }
      faces.push(...found)
    }
    return { faces, files }
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
        const preload = (href: string, as: string) =>
          HtmlWebpackPlugin.createHtmlTagObject('link', {
            rel: 'preload',
            as,
            href,
            ...(as === 'font' ? { type: 'font/woff2', crossorigin: '' } : {}),
          })
        const { faces, files } = this.fontFaces(
          compilation,
          [...bootFiles].filter(f => f.endsWith('.css')),
          data.publicPath,
        )
        data.headTags.push(
          HtmlWebpackPlugin.createHtmlTagObject('style', {}, faces.join('\n')),
          ...[...files].map(f => preload(data.publicPath + f, 'font')),
        )
        for (const file of bootFiles) {
          if (!loaded.has(file) && /\.(js|css)$/.test(file)) {
            data.headTags.push(
              preload(
                data.publicPath + file,
                file.endsWith('.css') ? 'style' : 'script',
              ),
            )
          }
        }
        return data
      })
    })
  }
}
