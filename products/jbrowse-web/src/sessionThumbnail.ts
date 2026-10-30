export const THUMBNAIL_WIDTH = 96
export const THUMBNAIL_HEIGHT = 60

// twice the drawn size, for HiDPI screens
const WIDTH = THUMBNAIL_WIDTH * 2
const MAX_HEIGHT = THUMBNAIL_HEIGHT * 2

// An export of a settled view takes well under a second. One still waiting on
// a fetch runs to the export's own half-hour bound, so the picture gives up
// sooner.
const TIMEOUT_MS = 10_000

// Held until the export settles, even past TIMEOUT_MS, so stalled exports
// cannot pile up
let exporting: Promise<unknown> | undefined

interface SvgExportingView {
  exportSvg(opts: { save: false; announceSkipped: false }): Promise<string>
}

function exportsSvg(view: unknown): view is SvgExportingView {
  return (
    typeof (view as Partial<SvgExportingView> | undefined)?.exportSvg ===
    'function'
  )
}

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`session thumbnail took over ${ms}ms`))
        }, ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function exportView(view: SvgExportingView) {
  if (exporting) {
    throw new Error('a session thumbnail export is still running')
  }
  const svg = view.exportSvg({ save: false, announceSkipped: false })
  exporting = svg
  svg
    .catch(() => {})
    .finally(() => {
      exporting = undefined
    })
  return withTimeout(svg, TIMEOUT_MS)
}

/**
 * A small picture of the session's first view that exports, rasterized from
 * that view's SVG export. A browser cannot capture its page the way Desktop's
 * `capturePage` does, and most view types already render themselves for
 * export. Undefined when the session has no view that exports or the picture
 * comes out empty; rejects when the export fails, outlasts TIMEOUT_MS or finds
 * another still running.
 */
export async function renderSessionThumbnail(views: readonly unknown[]) {
  const view = views.find(exportsSvg)
  return view ? rasterizeSvg(await exportView(view)) : undefined
}

async function rasterizeSvg(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    // an empty canvas encodes as a bare `data:,`, which draws as a broken image
    if (!img.width || !img.height) {
      return undefined
    }
    const height = (img.height * WIDTH) / img.width
    const canvas = document.createElement('canvas')
    canvas.width = WIDTH
    canvas.height = Math.min(MAX_HEIGHT, Math.round(height))
    canvas.getContext('2d')?.drawImage(img, 0, 0, WIDTH, height)
    // Safari has no WebP encoder and hands back a PNG, which is fine
    return canvas.toDataURL('image/webp', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}
