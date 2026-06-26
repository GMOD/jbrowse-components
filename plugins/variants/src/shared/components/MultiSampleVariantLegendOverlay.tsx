import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import MultiSampleVariantRowColors from './MultiSampleVariantRowColors.tsx'

import type { RowColorsModel } from './types.ts'
import type { LegendSection } from '@jbrowse/plugin-linear-genome-view'

interface LegendOverlayModel extends RowColorsModel {
  availableHeight: number
  showLegend: boolean
  legendSections(): LegendSection[]
  setShowLegend(s: boolean): void
  dismissLegendSection(id: string): void
}

const MultiSampleVariantLegendOverlay = observer(
  function MultiSampleVariantLegendOverlay({
    model,
    top = 0,
  }: {
    model: LegendOverlayModel
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
            <MultiSampleVariantRowColors model={model} />
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
  },
)

export default MultiSampleVariantLegendOverlay
