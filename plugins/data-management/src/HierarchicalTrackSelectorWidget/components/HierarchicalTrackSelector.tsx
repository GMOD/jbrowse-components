import { useState } from 'react'

import { observer } from 'mobx-react'

import AutoSizer from './AutoSizer'
import HierarchicalFab from './HierarchicalFab'
import HierarchicalHeader from './tree/HierarchicalHeader'
import HierarchicalTree from './tree/HierarchicalTree'

import type { HierarchicalTrackSelectorModel } from '../model'

// Don't use autosizer in jest and instead hardcode a height, otherwise fails
// jest tests
const AutoSizedHierarchicalTree = ({
  model,
  offset,
}: {
  model: HierarchicalTrackSelectorModel
  offset: number
}) => {
  return typeof jest === 'undefined' ? (
    <AutoSizer disableWidth>
      {args => (
        <HierarchicalTree
          height={(args.height || offset) - offset}
          model={model}
        />
      )}
    </AutoSizer>
  ) : (
    <HierarchicalTree height={9000} model={model} />
  )
}

const Wrapper = ({
  overrideDimensions,
  children,
}: {
  overrideDimensions?: { width: number; height: number }
  children: React.ReactNode
}) => {
  return overrideDimensions ? (
    <div style={{ ...overrideDimensions }}>{children}</div>
  ) : (
    children
  )
}
const HierarchicalTrackSelectorContainer = observer(function ({
  model,
  toolbarHeight,
  overrideDimensions,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight: number
  overrideDimensions?: { width: number; height: number }
}) {
  return (
    <Wrapper overrideDimensions={overrideDimensions}>
      <HierarchicalTrackSelector model={model} toolbarHeight={toolbarHeight} />
      <HierarchicalFab model={model} />
    </Wrapper>
  )
})

const HierarchicalTrackSelector = observer(function ({
  model,
  toolbarHeight = 0,
}: {
  model: HierarchicalTrackSelectorModel
  toolbarHeight?: number
}) {
  const [headerHeight, setHeaderHeight] = useState(0)
  return (
    <>
      <HierarchicalHeader model={model} setHeaderHeight={setHeaderHeight} />
      <AutoSizedHierarchicalTree
        model={model}
        offset={toolbarHeight + headerHeight}
      />
    </>
  )
})

export default HierarchicalTrackSelectorContainer
