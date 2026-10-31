import { formatBandLocation } from '@jbrowse/alignments-core'
import {
  CoverageTooltipTable,
  InterbaseTooltipTable,
  useTooltipTableStyles,
} from '@jbrowse/alignments-core/CoverageTooltipTables'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { assembleLocString } from '@jbrowse/core/util'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { bandAt } from '@jbrowse/core/util/bandLayout'
import { observer } from 'mobx-react'

import { selectionRegion } from '../openSubsequenceWidget.ts'
import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import { pointerLocation } from './mafHitTest.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MafPointerHit } from './mafHitTest.ts'
import type { MouseState } from '@jbrowse/core/ui'
import type { PxToBpResult } from '@jbrowse/core/util/Base1DUtils'

const ConservationBandTooltip = observer(function ConservationBandTooltip({
  model,
  pos,
  baseBp,
  clientPoint,
}: {
  model: LinearMafDisplayModel
  pos: PxToBpResult
  baseBp: number
  clientPoint: { x: number; y: number }
}) {
  const { classes } = useTooltipTableStyles()
  const bar = model.conservationHoverInfo(pos.index, baseBp)
  return bar ? (
    <BaseTooltip clientPoint={clientPoint}>
      <div className={classes.td}>
        {assembleLocString({
          refName: pos.refName,
          start: bar.start,
          end: bar.end,
        })}
      </div>
      <div className={classes.td}>
        {bar.codons ? 'Amino-acid identity' : 'Identity'}:{' '}
        {(bar.identity * 100).toFixed(1)}%
      </div>
    </BaseTooltip>
  ) : null
})

const CoverageBandTooltip = observer(function CoverageBandTooltip({
  model,
  pos,
  mouseState,
  clientPoint,
}: {
  model: LinearMafDisplayModel
  pos: PxToBpResult
  mouseState: MouseState
  clientPoint: { x: number; y: number }
}) {
  const { classes } = useTooltipTableStyles()
  const view = model.view
  // The band's own hit test first: an insertion bar or triangle gets the
  // interbase table, kept apart from the depth table.
  const bandHit = model.coverageBandHit(pos.index, mouseState.x, mouseState.y)
  const interbase = bandHit
    ? model.interbaseTooltipBin(pos.index, bandHit.position)
    : undefined
  if (bandHit && interbase) {
    return (
      <BaseTooltip clientPoint={clientPoint}>
        <InterbaseTooltipTable
          interbase={interbase.interbase}
          total={interbase.interbaseDepth}
          location={formatBandLocation(pos.refName, bandHit.position)}
          unit="Samples"
        />
      </BaseTooltip>
    )
  }
  // The bin is per-base, so it needs the base drawn under the cursor, which
  // `coord0` is not on a reversed region (see basePaintedAt).
  const bin = model.coverageTooltipBin(
    pos.index,
    basePaintedAt(pos, pos.offset),
    view.bpPerPx,
    pos.reversed,
  )
  return bin ? (
    <BaseTooltip clientPoint={clientPoint}>
      <CoverageTooltipTable
        bin={bin}
        location={formatBandLocation(pos.refName, bin.position)}
        unit="Samples"
      >
        {Number.isFinite(bin.identity) ? (
          // Percent identity excludes the reference row; a sample N/IUPAC
          // code counts as a mismatch, as in SNP coloring.
          <div className={classes.td}>
            Identity: {(bin.identity * 100).toFixed(1)}%
          </div>
        ) : null}
      </CoverageTooltipTable>
    </BaseTooltip>
  ) : null
})

const MAFTooltip = observer(function MAFTooltip({
  model,
  hit,
  mouseState,
  origMouseX,
}: {
  /** the cursor already projected + hit-tested by the display body */
  hit: MafPointerHit
  /**
   * The chrome's measured pointer, required: an omitted `clientPoint` puts
   * floating-ui into pointer-tracking mode, which allocates a virtual reference
   * on every window mousemove (ADR-028).
   */
  mouseState: MouseState
  model: LinearMafDisplayModel
  origMouseX?: number
}) {
  const clientPoint = { x: mouseState.clientX, y: mouseState.clientY }
  const view = model.view
  const { pos: p2, baseBp, rowIndex, inBands, onRow, hover } = hit
  const selection =
    origMouseX === undefined
      ? undefined
      : selectionRegion(
          view.pxToBp(Math.min(origMouseX, mouseState.x)),
          view.pxToBp(Math.max(origMouseX, mouseState.x)),
        )

  // Over the bands above the rows: the band the fold placed under the pointer
  // answers, the conservation band with the bar it paints and the coverage
  // band with the shared alignments-core tooltip bin. `index` from pxToBp
  // matches the rpcDataMap key.
  if (inBands) {
    const band = p2.oob ? undefined : bandAt(model.topBands, mouseState.y)
    return band === 'conservation' ? (
      <ConservationBandTooltip
        model={model}
        pos={p2}
        baseBp={baseBp}
        clientPoint={clientPoint}
      />
    ) : band === 'coverage' ? (
      <CoverageBandTooltip
        model={model}
        pos={p2}
        mouseState={mouseState}
        clientPoint={clientPoint}
      />
    ) : null
  }

  // `onRow` is false during a selection drag, so the drag's range readout
  // stays. `baseBp`, not a floored `gposFrac`: both index per-base data, so
  // they want the base painted under the pixel (see `HoverBp`).
  const frame = onRow
    ? model.frameHoverInfo(p2.index, baseBp, rowIndex)
    : undefined
  const codon = onRow
    ? model.codonHoverInfo(p2.index, baseBp, rowIndex)
    : undefined
  // The zoom-out tier has no detail to hover, so hit-test the drawn bars: the
  // only way to identify a summary row once the sidebar labels go.
  const summary = onRow
    ? model.summaryHoverInfo(rowIndex, mouseState.x)
    : undefined
  const identity = onRow
    ? model.identityHoverInfo(p2.index, baseBp, rowIndex)
    : undefined

  return (
    <BaseTooltip clientPoint={clientPoint}>
      <MafAlignmentTooltipContents
        selection={selection}
        p2={pointerLocation(hit)}
        hover={hover}
        frame={frame}
        codon={codon}
        summary={summary}
        summarySampleLabel={model.sources[rowIndex]?.label}
        identity={identity}
      />
    </BaseTooltip>
  )
})

export default MAFTooltip
