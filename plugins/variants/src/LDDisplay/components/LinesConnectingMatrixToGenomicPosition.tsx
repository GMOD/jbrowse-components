import { useMemo, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import {
  ConnectorLine,
  ConnectorLineField,
  ConnectorResizeHandle,
} from '../../shared/ConnectorLines.tsx'
import VariantLabels from './VariantLabels.tsx'
import Wrapper from './Wrapper.tsx'
import { getSnpViewportX } from './snpViewportX.ts'

import type { LDSnp } from '../../VariantRPC/getLDMatrix.ts'
import type { ConnectorCoord } from '../../shared/ConnectorLines.tsx'
import type { SharedLDModel } from '../shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Horizontal flips need nothing here: the worker hands back `snps` already in
// screen order (`RenderLDDataRPC/reversedRegions.ts`), so the index axis and
// the reversed-aware `getSnpViewportX` anchor agree.
function getMatrixX(
  idx: number,
  blockWidth: number,
  n: number,
  viewScale: number,
  viewOffsetX: number,
) {
  return (((idx + 0.5) * blockWidth) / n) * viewScale + viewOffsetX
}

interface HoveredLine extends ConnectorCoord {
  snp: LDSnp
}

const AllLines = observer(function AllLines({
  model,
  onHover,
}: {
  model: SharedLDModel
  onHover: (arg: HoveredLine | undefined) => void
}) {
  const { assemblyManager } = getSession(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const { lineZoneHeight, snps } = model
  const { assemblyNames, dynamicBlocks } = view
  const assembly = assemblyManager.get(assemblyNames[0]!)
  const blockWidth = dynamicBlocks.totalWidthPxWithoutBorders
  const n = snps.length
  const { scale: viewScale, viewOffsetX } = model.renderTransform

  const lineCoords = useMemo(() => {
    if (!assembly || n === 0) {
      return []
    }
    return snps.map((snp, i) => ({
      snp,
      mx: getMatrixX(i, blockWidth, n, viewScale, viewOffsetX),
      gx: getSnpViewportX(view, assembly, snp),
    }))
  }, [assembly, n, snps, blockWidth, viewScale, viewOffsetX, view])

  if (!assembly || n === 0) {
    return null
  }

  return (
    <ConnectorLineField
      lineCoords={lineCoords}
      lineZoneHeight={lineZoneHeight}
      strokeWidth={1}
      onHoverIndex={i => {
        onHover(i === undefined ? undefined : lineCoords[i])
      }}
    >
      <VariantLabels model={model} />
    </ConnectorLineField>
  )
})

const LinesConnectingMatrixToGenomicPosition = observer(
  function LinesConnectingMatrixToGenomicPosition({
    model,
    exportSVG,
    yOffset = 0,
  }: {
    model: SharedLDModel
    exportSVG?: boolean
    yOffset?: number
  }) {
    const [hovered, setHovered] = useState<HoveredLine>()
    const { lineZoneHeight, snps } = model

    if (snps.length === 0) {
      return null
    }

    return (
      <>
        <Wrapper exportSVG={exportSVG} model={model} yOffset={yOffset}>
          <AllLines model={model} onHover={setHovered} />
          {hovered ? (
            <>
              <ConnectorLine
                mx={hovered.mx}
                gx={hovered.gx}
                lineZoneHeight={lineZoneHeight}
              />
              {hovered.snp.id ? (
                <BaseTooltip>{hovered.snp.id}</BaseTooltip>
              ) : null}
            </>
          ) : null}
        </Wrapper>
        {!exportSVG ? (
          <ConnectorResizeHandle
            lineZoneHeight={lineZoneHeight}
            onResize={d => {
              model.setLineZoneHeight(lineZoneHeight + d)
            }}
          />
        ) : null}
      </>
    )
  },
)

export default LinesConnectingMatrixToGenomicPosition
