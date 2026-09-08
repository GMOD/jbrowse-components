import { observer } from 'mobx-react'

import LDLabelZone from './LDLabelZone.tsx'
import LinesConnectingMatrixToGenomicPosition from './LinesConnectingMatrixToGenomicPosition.tsx'

import type { SharedLDModel } from '../shared.ts'
import type { PaintLayerOpts } from '@jbrowse/core/util/paintLayer'

// The band above the triangle, in whichever form the loaded matrix calls for:
// genomic-positions mode already draws each column at its own genomic x, so
// there is nothing to connect and the zone holds only the labels; index mode
// draws the connector lines, with the labels riding along inside them. One
// component rather than the same ternary at the live canvas and at the SVG
// export — the two used to answer it from the config slot, which is a request
// and not what loaded.
const LDColumnZone = observer(function LDColumnZone({
  model,
  exportSVG,
  opts,
}: {
  model: SharedLDModel
  exportSVG?: boolean
  opts?: PaintLayerOpts
}) {
  return model.effectiveUseGenomicPositions ? (
    <LDLabelZone model={model} exportSVG={exportSVG} />
  ) : (
    <LinesConnectingMatrixToGenomicPosition
      model={model}
      exportSVG={exportSVG}
      opts={opts}
    />
  )
})

export default LDColumnZone
