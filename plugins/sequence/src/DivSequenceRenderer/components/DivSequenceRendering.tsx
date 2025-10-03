import type { ReactNode } from 'react'

import {
  complement,
  defaultCodonTable,
  generateCodonTable,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Sequence from './Sequence'
import Translation from './Translation'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Frame, Region } from '@jbrowse/core/util'

function SequenceSVG({
  regions,
  width,
  colorByCDS,
  features = new Map(),
  showReverse = true,
  showForward = true,
  showTranslation = true,
  sequenceType = 'dna',
  bpPerPx,
  rowHeight,
}: {
  regions: Region[]
  width: number
  features: Map<string, Feature>
  colorByCDS: boolean
  showReverse?: boolean
  showForward?: boolean
  showTranslation?: boolean
  sequenceType?: string
  bpPerPx: number
  rowHeight: number
}) {
  const region = regions[0]!
  const codonTable = generateCodonTable(defaultCodonTable)
  const [feature] = [...features.values()]
  if (!feature) {
    return null
  }
  const seq: string = feature.get('seq')
  if (!seq) {
    return null
  }

  // incrementer for the y-position of the current sequence being rendered
  // (applies to both translation rows and dna rows)
  let currY = -rowHeight

  const showSequence = bpPerPx <= 1

  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []

  // if region.reversed, the forward translation is on bottom, reverse on top
  const [topFrames, bottomFrames] = region.reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]
  return (
    <>
      {topFrames.map(index => (
        <Translation
          key={`translation-${index}`}
          width={width}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
          height={rowHeight}
          reverse={region.reversed}
        />
      ))}

      {showForward && showSequence ? (
        <Sequence
          height={rowHeight}
          sequenceType={sequenceType}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? complement(seq) : seq}
          bpPerPx={bpPerPx}
        />
      ) : null}

      {showReverse && showSequence ? (
        <Sequence
          height={rowHeight}
          sequenceType={sequenceType}
          y={(currY += rowHeight)}
          feature={feature}
          region={region}
          seq={region.reversed ? seq : complement(seq)}
          bpPerPx={bpPerPx}
        />
      ) : null}

      {bottomFrames.map(index => (
        <Translation
          key={`rev-translation-${index}`}
          width={width}
          colorByCDS={colorByCDS}
          seq={seq}
          y={(currY += rowHeight)}
          codonTable={codonTable}
          frame={index}
          bpPerPx={bpPerPx}
          region={region}
          seqStart={feature.get('start')}
          height={rowHeight}
          reverse={!region.reversed}
        />
      ))}
    </>
  )
}

function Wrapper({
  exportSVG,
  width,
  totalHeight,
  children,
}: {
  exportSVG?: { rasterizeLayers: boolean }
  width: number
  totalHeight: number
  children: ReactNode
}) {
  return exportSVG ? (
    children
  ) : (
    <svg
      data-testid="sequence_track"
      width={width}
      height={totalHeight}
      style={{
        // use block because svg by default is inline, which adds a margin
        display: 'block',
        width,
        height: totalHeight,
        userSelect: 'none',
      }}
    >
      {children}
    </svg>
  )
}

const DivSequenceRendering = observer(function ({
  exportSVG,
  features,
  regions,
  colorByCDS,
  bpPerPx,
  rowHeight,
  sequenceHeight,
  showForward,
  showReverse,
  showTranslation,
}: {
  exportSVG?: { rasterizeLayers: boolean }
  features: Map<string, Feature>
  regions: Region[]
  colorByCDS: boolean
  bpPerPx: number
  rowHeight: number
  sequenceHeight: number
  config: AnyConfigurationModel
  showForward?: boolean
  showReverse?: boolean
  showTranslation?: boolean
}) {
  const region = regions[0]!
  const width = Math.ceil((region.end - region.start) / bpPerPx)

  return (
    <Wrapper exportSVG={exportSVG} totalHeight={sequenceHeight} width={width}>
      <SequenceSVG
        width={width}
        showReverse={showReverse}
        showForward={showForward}
        showTranslation={showTranslation}
        colorByCDS={colorByCDS}
        bpPerPx={bpPerPx}
        rowHeight={rowHeight}
        features={features}
        regions={regions}
      />
    </Wrapper>
  )
})

export default DivSequenceRendering
