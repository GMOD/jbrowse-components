import { withFreshSvgClipIds } from '../util/SvgCanvas.ts'
import { renderToStaticMarkup } from '../util/renderToStaticMarkup.ts'
import { normalizeSvgMarkup } from './normalizeSvgMarkup.ts'

import type React from 'react'

export { normalizeSvgMarkup } from './normalizeSvgMarkup.ts'

/**
 * Serialize one standalone SVG document: its own clip-id numbering run (see
 * `withFreshSvgClipIds`) and the file rules in `normalizeSvgMarkup`.
 */
export function serializeSvg(node: React.ReactElement) {
  return normalizeSvgMarkup(
    withFreshSvgClipIds(() => renderToStaticMarkup(node)),
  )
}
