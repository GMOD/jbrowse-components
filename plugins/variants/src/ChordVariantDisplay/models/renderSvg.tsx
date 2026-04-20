import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { ReactRendering } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type { ExportSvgOptions } from '@jbrowse/plugin-circular-view'
import type { CircularViewModel } from '@jbrowse/plugin-circular-view'
import type { ThemeOptions } from '@mui/material'

export async function renderSvg(
  self: any,
  opts: ExportSvgOptions & { theme?: ThemeOptions },
) {
  const view = getContainingView(self) as CircularViewModel
  const { rpcManager } = getSession(view)
  const { rendererType } = self

  const result = await rendererType.renderInClient(rpcManager, {
    assemblyName: view.displayedRegions[0]!.assemblyName,
    adapterConfig: structuredClone(self.adapterConfig),
    rendererType: rendererType.name,
    regions: structuredClone(view.displayedRegions),
    sessionId: getRpcSessionId(self),
    trackInstanceId: getContainingTrack(self).id,
    timeout: 1000000,
    ...self.renderProps(),
    radius: view.radiusPx,
    bezierRadius: view.radiusPx * self.bezierRadiusRatio,
    blockDefinitions: self.blockDefinitions,
    renderingProps: { displayModel: self },
    exportSVG: opts,
    theme: opts.theme,
  })

  return <ReactRendering rendering={result} />
}
