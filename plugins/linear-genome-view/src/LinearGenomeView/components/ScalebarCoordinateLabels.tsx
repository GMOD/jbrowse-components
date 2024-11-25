import React from 'react'
import { observer } from 'mobx-react'

// locals
import ScalebarCoordinateTicks from './ScalebarCoordinateTicks'
import {
  ElidedBlock as ElidedBlockComponent,
  InterRegionPaddingBlock as InterRegionPaddingBlockComponent,
} from '../../BaseLinearDisplay/components/Block'
import type { LinearGenomeViewModel } from '..'

type LGV = LinearGenomeViewModel

const ScalebarCoordinateLabels = observer(function ({ model }: { model: LGV }) {
  const { staticBlocks, bpPerPx } = model
  return (
    <>
      {staticBlocks.map((b, idx) => {
        const { key, widthPx } = b
        const k = `${key}-${idx}`
        if (b.type === 'ContentBlock') {
          return <ScalebarCoordinateTicks key={k} block={b} bpPerPx={bpPerPx} />
        } else if (b.type === 'ElidedBlock') {
          return <ElidedBlockComponent key={k} width={widthPx} />
        } else if (b.type === 'InterRegionPaddingBlock') {
          return (
            <InterRegionPaddingBlockComponent
              key={k}
              width={widthPx}
              style={{ background: 'none' }}
              boundary={b.variant === 'boundary'}
            />
          )
        } else {
          return null
        }
      })}
    </>
  )
})

export default ScalebarCoordinateLabels
