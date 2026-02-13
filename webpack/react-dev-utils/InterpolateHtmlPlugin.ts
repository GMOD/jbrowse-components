import type { Compiler } from 'webpack'

export default class InterpolateHtmlPlugin {
  htmlWebpackPlugin: {
    getHooks: (compilation: unknown) => {
      afterTemplateExecution: {
        tap: (name: string, cb: (data: { html: string }) => void) => void
      }
    }
  }
  replacements: Record<string, string>

  constructor(
    htmlWebpackPlugin: InterpolateHtmlPlugin['htmlWebpackPlugin'],
    replacements: Record<string, string>,
  ) {
    this.htmlWebpackPlugin = htmlWebpackPlugin
    this.replacements = replacements
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('InterpolateHtmlPlugin', compilation => {
      this.htmlWebpackPlugin
        .getHooks(compilation)
        .afterTemplateExecution.tap('InterpolateHtmlPlugin', data => {
          for (const key of Object.keys(this.replacements)) {
            data.html = data.html.replaceAll(
              `%${key}%`,
              this.replacements[key]!,
            )
          }
        })
    })
  }
}
