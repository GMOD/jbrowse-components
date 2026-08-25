import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { RowSeparatorLines, treeSidebarOffset } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import { SEPARATOR_OPACITY } from '../constants.ts'
import SvgSampleRowLabelGutter from './SvgSampleRowLabelGutter.tsx'

import type { SampleRowLabelsModel } from './types.ts'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

interface VariantOverlayModel extends SampleRowLabelsModel {
  showLegend: boolean
  showRowSeparators: boolean
  canvasWidthPx: number
  legendSections(): LegendSection[]
  setShowLegend(s: boolean): void
  dismissLegendSection(id: string): void
}

// Everything the multi-sample variant displays float over their canvas: the
// left-hand sample gutter, the row separators and the color key. On-screen
// counterpart of `SvgVariantOverlay`, which composes the same three for the
// export — the gutter from the very same component, the key from
// `SvgVariantLegend` off the same `legendSections()`.
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
    showRowSeparators,
    sources,
    effectiveRowHeight,
    scrollTop,
    canvasWidthPx,
  } = model
  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top,
          left: 0,
          width: '100%',
          height: availableHeight,
          zIndex: 100,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {showRowSeparators ? (
          <RowSeparatorLines
            numRows={sources.length}
            rowHeight={effectiveRowHeight}
            width={canvasWidthPx}
            opacity={SEPARATOR_OPACITY}
            scrollTop={scrollTop}
            viewportHeight={availableHeight}
          />
        ) : null}
        <g transform={`translate(${treeSidebarOffset(model)})`}>
          <SvgSampleRowLabelGutter model={model} />
        </g>
      </svg>
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
