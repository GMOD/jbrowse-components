export const THUMBNAIL_WIDTH = 96
export const THUMBNAIL_HEIGHT = 60

// twice the drawn size, for HiDPI screens
const WIDTH = THUMBNAIL_WIDTH * 2
const MAX_HEIGHT = THUMBNAIL_HEIGHT * 2

// An export of a settled view takes well under a second. One still waiting on
// a fetch would hold the in-flight guard for the export's own half-hour bound.
const TIMEOUT_MS = 10_000

interface SvgExportingView {
  exportSvg(opts: { save: false; announceSkipped: false }): Promise<string>
}

function exportsSvg(view: unknown): view is SvgExportingView {
  return (
    typeof (view as Partial<SvgExportingView> | undefined)?.exportSvg ===
    'function'
  )
}

function timeout(ms: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`session thumbnail took over ${ms}ms`))
    }, ms)
  })
}

/**
 * A small picture of the session's first view, drawn by the view's own SVG
 * export. A browser cannot capture its page the way Desktop's `capturePage`
 * does, and every view type already renders itself for export. Undefined when
 * the session has no view that exports or the picture comes out empty; rejects
 * when the export fails or outlasts TIMEOUT_MS.
 */
export async function renderSessionThumbnail(views: readonly unknown[]) {
  const view = views[0]
  return exportsSvg(view)
    ? rasterizeSvg(
        await Promise.race([
          view.exportSvg({ save: false, announceSkipped: false }),
          timeout(TIMEOUT_MS),
        ]),
      )
    : undefined
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
