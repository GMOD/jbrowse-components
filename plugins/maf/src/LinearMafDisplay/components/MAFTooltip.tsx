import { formatBandLocation } from '@jbrowse/alignments-core'
import {
  CoverageTooltipTable,
  InterbaseTooltipTable,
  useTooltipTableStyles,
} from '@jbrowse/alignments-core/CoverageTooltipTables'
import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { basePaintedAt } from '@jbrowse/core/util/Base1DUtils'
import { observer } from 'mobx-react'

import { selectionRegion } from '../openSubsequenceWidget.ts'
import MafAlignmentTooltipContents from './MafAlignmentTooltipContents.tsx'
import { pointerLocation } from './mafHitTest.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'
import type { MafPointerHit } from './mafHitTest.ts'
import type { MouseState } from '@jbrowse/core/ui'

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
  const { classes } = useTooltipTableStyles()
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

  // Over the bands above the rows: the shared alignments-core tooltip bin
  // carries depth, SNP and identity. `index` from pxToBp matches the rpcDataMap
  // key.
  if (inBands) {
    if (p2.oob) {
      return null
    }
    // The band's own hit test first: an insertion bar or triangle gets the
    // interbase table, kept apart from the depth table.
    const bandHit = model.coverageBandHit(p2.index, mouseState.x, mouseState.y)
    const interbase = bandHit
      ? model.interbaseTooltipBin(p2.index, bandHit.position)
      : undefined
    if (bandHit && interbase) {
      return (
        <BaseTooltip clientPoint={clientPoint}>
          <InterbaseTooltipTable
            interbase={interbase.interbase}
            total={interbase.interbaseDepth}
            location={formatBandLocation(p2.refName, bandHit.position)}
            unit="Samples"
          />
        </BaseTooltip>
      )
    }
    // The bin is per-base, so it needs the base drawn under the cursor, which
    // `coord0` is not on a reversed region (see basePaintedAt).
    const bin = model.coverageTooltipBin(
      p2.index,
      basePaintedAt(p2, p2.offset),
      view.bpPerPx,
      p2.reversed,
    )
    return bin ? (
      <BaseTooltip clientPoint={clientPoint}>
        <CoverageTooltipTable
          bin={bin}
          location={formatBandLocation(p2.refName, bin.position)}
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
        summarySampleLabel={model.samples[rowIndex]?.label}
        identity={identity}
      />
    </BaseTooltip>
  )
})

export default MAFTooltip
