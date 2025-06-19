import { readConfObject } from '@jbrowse/core/configuration'
import { useTheme } from '@mui/material'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { observer } from 'mobx-react'

import Arrow from './Arrow'
import { getBoxColor } from './getBoxColor'
import { usePeptides } from '../hooks/usePeptides'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { SceneGraph } from '@jbrowse/core/util/layouts'

const CDS = observer(function CDS(props: {
  feature: Feature
  region: Region
  config: AnyConfigurationModel
  featureLayout: SceneGraph
  bpPerPx: number
  selected?: boolean
  topLevel?: boolean
  colorByCDS: boolean
  displayModel: any
}) {
  const theme = useTheme()
  const {
    colorByCDS,
    feature,
    region,
    config,
    featureLayout,
    bpPerPx,
    topLevel,
    displayModel,
  } = props
  const { start, end } = region
  const screenWidth = Math.ceil((end - start) / bpPerPx)
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand')
  const width = (featureEnd - featureStart) / bpPerPx
  const { left = 0, top = 0, right = 0, height = 0 } = featureLayout.absolute
  const zoomedInEnough = 1 / bpPerPx >= 12
  const dontRenderRect = left + width < 0
  const dontRenderLetters = !zoomedInEnough
  const doRender = !dontRenderLetters && !dontRenderRect
  const leftWithinBlock = Math.max(left, 0)
  const diff = leftWithinBlock - left
  const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))
  const parent = feature.parent() ?? feature
  const protein = usePeptides({
    feature: parent,
    region,
    displayModel,
  })
  const g2p = doRender
    ? // @ts-expect-error
      genomeToTranscriptSeqMapping(parent.toJSON()).g2p
    : undefined

  const elements = []
  if (g2p && protein && doRender) {
    const len = featureEnd - featureStart + 1
    if (strand === -1) {
      for (let i = 0; i < len; i++) {
        const elt = g2p[featureEnd + 1 - i]
        elements.push(
          <text
            key={`${i}-${elt}`}
            x={right - (1 / bpPerPx) * i + 1 / bpPerPx / 2 - 4}
            y={top + height - 1}
            fontSize={height}
            fill="black"
          >
            {elt !== undefined ? (protein[elt] ?? '&') : '*'}
          </text>,
        )
      }
    } else {
      for (let i = 0; i < len; i++) {
        const elt = g2p[featureStart + i]
        elements.push(
          <text
            key={`${i}-${elt}`}
            x={left + (1 / bpPerPx) * i + 1 / bpPerPx / 2 - 4}
            y={top + height - 1}
            fontSize={height}
            fill="black"
          >
            {elt !== undefined ? (protein[elt] ?? '&') : '*'}
          </text>,
        )
      }
    }
  }
  // if feature has parent and type is intron, then don't render the intron
  // subfeature (if it doesn't have a parent, then maybe the introns are
  // separately displayed features that should be displayed)
  return dontRenderRect ? null : (
    <>
      {topLevel ? <Arrow {...props} /> : null}
      <rect
        data-testid={`box-${feature.id()}`}
        x={leftWithinBlock}
        y={top}
        width={widthWithinBlock}
        height={height}
        fill={getBoxColor({
          feature,
          config,
          colorByCDS,
          theme,
        })}
        stroke={readConfObject(config, 'outline', { feature }) as string}
      />
      {elements}
    </>
  )
})

export default CDS
