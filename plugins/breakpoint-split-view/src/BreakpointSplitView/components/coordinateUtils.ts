import { getPxFromCoordinate } from '../util'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function getViewCoordinates(
  view: LinearGenomeViewModel,
  refName: string,
  position: number,
) {
  const px = getPxFromCoordinate(view, refName, position)
  const reversed = view.pxToBp(px).reversed
  return {
    px,
    reversed,
    reversalFactor: reversed ? -1 : 1,
  }
}
