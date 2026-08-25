import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import {
  RowLabelsOverlay,
  RowSeparatorLines,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../constants.ts'

import type { VariantRowsModel } from './types.ts'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

interface VariantOverlayModel extends VariantRowsModel {
  showLegend: boolean
  legendSections(): LegendSection[]
  setShowLegend(s: boolean): void
  dismissLegendSection(id: string): void
}

// Everything the multi-sample variant displays float over their canvas: the
// row labels, the row separators and the color key. On-screen counterpart of
// `SvgVariantOverlay`, which composes the same three for the export — the
// labels through `SvgTreeSidebar`, the key from `SvgVariantLegend` off the same
// `legendSections()`.
//
// The labels are tree-sidebar's `RowLabelsOverlay`, the same one the other
// three row displays mount, tinted by `labelColor`. These displays used to draw
// their own gutter, because the palette wrote `color` and the shared labels
// read `labelColor` — the trap tree-sidebar's CLAUDE.md records MAF falling
// into too.
const MultiSampleVariantOverlay = observer(function MultiSampleVariantOverlay({
  model,
  top = 0,
}: {
  model: VariantOverlayModel
  top?: number
}) {
  const {
    availableHeight,
    showLegend,
    showRowLabels,
    showRowSeparators,
    sources,
    effectiveRowHeight,
    scrollTop,
    canvasWidthPx,
  } = model
  return (
    <>
      {showRowSeparators ? (
        <svg
          style={{
            position: 'absolute',
            top,
            left: 0,
            width: canvasWidthPx,
            height: availableHeight,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={effectiveRowHeight}
            width={canvasWidthPx}
            opacity={SEPARATOR_OPACITY}
            scrollTop={scrollTop}
            viewportHeight={availableHeight}
          />
        </svg>
      ) : null}
      <RowLabelsOverlay
        testId="variant-row-labels"
        sources={sources}
        rowHeight={effectiveRowHeight}
        labelOffset={treeSidebarOffset(model)}
        width={canvasWidthPx}
        height={availableHeight}
        top={top}
        scrollTop={scrollTop}
        showLabels={showRowLabels}
      />
      {showLegend ? (
        <FloatingLegend
          sections={model.legendSections()}
          onDismiss={() => {
            model.setShowLegend(false)
          }}
          onDismissSection={id => {
            model.dismissLegendSection(id)
          }}
        />
      ) : null}
    </>
  )
})

export default MultiSampleVariantOverlay
