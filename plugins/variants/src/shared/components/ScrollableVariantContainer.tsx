import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import LegendBar from './MultiVariantLegendBar.tsx'
import TreeSidebar from './TreeSidebar.tsx'

import type { MultiVariantBaseModel } from '../MultiVariantBaseModel.ts'

interface ScrollableVariantContainerProps {
  model: MultiVariantBaseModel
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
        <LegendBar model={model} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: '100%',
          }}
        >
          <BaseLinearDisplayComponent model={model} />
        </div>
      </div>
    )
  },
)

export default ScrollableVariantContainer
