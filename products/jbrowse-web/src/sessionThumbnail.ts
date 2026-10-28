const WIDTH = 480
const MAX_HEIGHT = 300

interface SvgExportingView {
  exportSvg?: (opts: { save: false; announceSkipped: false }) => Promise<string>
}

/**
 * A small picture of the session's first view, drawn by the view's own SVG
 * export. A browser cannot capture its page the way Desktop's `capturePage`
 * does, and every view type already renders itself for export. Undefined when
 * the session has no view that exports.
 */
export async function renderSessionThumbnail(
  views: readonly SvgExportingView[],
) {
  const svg = await views[0]?.exportSvg?.({
    save: false,
    announceSkipped: false,
  })
  return svg === undefined ? undefined : rasterizeSvg(svg)
}

async function rasterizeSvg(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
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
