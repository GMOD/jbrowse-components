import { useMemo, useState } from 'react'

import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { getContainingView, getSession, notEmpty } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import ArcTooltipContents from './ArcTooltipContents'
import { featureToArcData } from './arcUtils'

import type { ArcData } from './arcUtils'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const YSCALEBAR_LABEL_OFFSET = 5

export interface ArcDisplayModel {
  showArcsSetting: boolean
  height: number
  skipFeatures: Feature[]
}

const SashimiArcs = observer(function ({ model }: { model: ArcDisplayModel }) {
  const { showArcsSetting, height, skipFeatures } = model
  const view = getContainingView(model) as LinearGenomeViewModel
  const { assemblyManager } = getSession(model)
  const [hoverInfo, setHoverInfo] = useState<{
    arc: ArcData
    x: number
    y: number
  } | null>(null)

  const width = Math.round(view.dynamicBlocks.totalWidthPx)
  const effectiveHeight = height - YSCALEBAR_LABEL_OFFSET * 2

  const { arcs, drawnAtBpPerPx, drawnAtOffsetPx } = useMemo(() => {
    const currentOffsetPx = view.offsetPx
    const assembly = assemblyManager.get(view.assemblyNames[0]!)
    return {
      arcs: assembly
        ? skipFeatures
            .map(f =>
              featureToArcData(
                f,
                view,
                effectiveHeight,
                currentOffsetPx,
                assembly,
              ),
            )
            .filter(notEmpty)
        : [],
      drawnAtBpPerPx: view.bpPerPx,
      drawnAtOffsetPx: currentOffsetPx,
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipFeatures, view.bpPerPx, effectiveHeight])

  if (
    !showArcsSetting ||
    !view.initialized ||
    drawnAtBpPerPx !== view.bpPerPx
  ) {
    return null
  }

  const left = drawnAtOffsetPx - view.offsetPx

  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top: YSCALEBAR_LABEL_OFFSET,
          left,
          pointerEvents: 'none',
          height: effectiveHeight,
          width,
        }}
      >
        {arcs.map(arc => (
          <path
            key={arc.id}
            d={arc.path}
            stroke={arc.stroke}
            strokeWidth={arc.strokeWidth}
            fill="none"
            style={{
              pointerEvents: 'stroke',
              cursor: 'pointer',
            }}
            onMouseEnter={event => {
              setHoverInfo({
                arc,
                x: event.clientX,
                y: event.clientY,
              })
            }}
            onMouseLeave={() => {
              setHoverInfo(null)
            }}
          />
        ))}
      </svg>
      {hoverInfo ? (
        <BaseTooltip clientPoint={{ x: hoverInfo.x + 5, y: hoverInfo.y }}>
          <ArcTooltipContents arc={hoverInfo.arc} />
        </BaseTooltip>
      ) : null}
    </>
  )
})

export default SashimiArcs
