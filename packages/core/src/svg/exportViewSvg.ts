import type { SvgRasterCanvasOpts } from '../util/createSvgRasterCanvas.ts'
import type React from 'react'

/** What every view's `exportSvg` accepts. A view with more extends it. */
export interface ViewExportSvgOptions extends SvgRasterCanvasOpts {
  rasterizeLayers?: boolean
  format?: 'svg' | 'png'
  filename?: string
  /**
   * Whether to hand the result to the browser's download path. Default true,
   * which is the dialog. False returns the markup and writes nothing — the
   * caller has somewhere of its own to put it, and a download it did not ask
   * for would land beside that under a name it did not choose.
   */
  save?: boolean
  Wrapper?: React.FC<{ children: React.ReactNode }>
  /** a named theme; the session's active one when absent */
  themeName?: string
  fontFamily?: string
}

/**
 * The body of every view's `exportSvg` action: load the view's lazy
 * `renderToSvg`, render, save unless `save: false`, and return the markup.
 */
export async function exportViewSvg<V, O extends ViewExportSvgOptions>(
  view: V,
  opts: O,
  load: () => Promise<{
    renderToSvg: (view: V, opts: O) => Promise<string>
  }>,
) {
  const { renderToSvg } = await load()
  const html = await renderToSvg(view, opts)
  if (opts.save !== false) {
    const { saveSvgAsImage } = await import('./saveSvgAsImage.ts')
    await saveSvgAsImage(html, opts)
  }
  return html
}
