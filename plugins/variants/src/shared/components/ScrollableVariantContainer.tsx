import { Suspense } from 'react'

import { FloatingLegend } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import TreeSidebar from './TreeSidebar.tsx'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'

type Model = MultiSampleVariantBaseModel & {
  DisplayMessageComponent: React.ComponentType<any>
}

interface ScrollableVariantContainerProps {
  model: Model
  topOffset?: number
  testId?: string
}

const ScrollableVariantContainer = observer(
  function ScrollableVariantContainer({
    model,
    topOffset = 0,
    testId,
  }: ScrollableVariantContainerProps) {
    const { setScrollTop, autoHeight, availableHeight } = model

    return (
      <div
        data-testid={testId}
        style={{
          position: 'absolute',
          top: topOffset,
          height: availableHeight,
          width: '100%',
          overflowY: autoHeight ? 'hidden' : 'auto',
          overflowX: 'hidden',
        }}
        onScroll={evt => {
          setScrollTop(evt.currentTarget.scrollTop)
        }}
      >
        <TreeSidebar model={model} />
        <FloatingLegend items={model.legendItems()} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: '100%',
          }}
        >
          <Suspense fallback={null}>
            <model.DisplayMessageComponent model={model} />
          </Suspense>
        </div>
      </div>
    )
  },
)

export default ScrollableVariantContainer
