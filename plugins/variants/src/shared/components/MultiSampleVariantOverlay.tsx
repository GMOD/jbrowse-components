import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import SvgSampleRowLabelGutter from './SvgSampleRowLabelGutter.tsx'

import type { SampleRowLabelsModel } from './types.ts'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

interface VariantOverlayModel extends SampleRowLabelsModel {
  availableHeight: number
  showLegend: boolean
  legendSections(): LegendSection[]
  setShowLegend(s: boolean): void
  dismissLegendSection(id: string): void
}

// Everything the multi-sample variant displays float over their canvas: the
// left-hand sample gutter and the color key. On-screen counterpart of
// `SvgVariantOverlay`, which composes the same two for the export — the gutter
// from the very same component, the key from `SvgVariantLegend` off the same
// `legendSections()`.
const MultiSampleVariantOverlay = observer(function MultiSampleVariantOverlay({
  model,
  top = 0,
}: {
  model: VariantOverlayModel
  top?: number
}) {
  const { availableHeight, showTree, hierarchy, treeAreaWidth, showLegend } =
    model
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
        <g
          transform={`translate(${showTree && hierarchy ? treeAreaWidth : 0})`}
        >
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
