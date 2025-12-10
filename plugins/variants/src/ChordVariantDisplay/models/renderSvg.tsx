import { ReactRendering } from '@jbrowse/core/util'

import { renderReactionData, renderReactionEffect } from './renderReaction'

import type { ExportSvgOptions } from '@jbrowse/plugin-circular-view'
import type { ThemeOptions } from '@mui/material'

export async function renderSvg(
  self: Parameters<typeof renderReactionData>[0],
  opts: ExportSvgOptions & {
    theme?: ThemeOptions
  },
) {
  const data = renderReactionData(self)
  const rendering = await renderReactionEffect({
    ...data,
    exportSVG: opts,
    theme: opts.theme || data.renderProps.theme,
  })
  return <ReactRendering rendering={rendering} />
}
