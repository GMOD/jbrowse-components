import { useState } from 'react'

import { observer } from 'mobx-react'

import AutoSizer from './AutoSizer.tsx'
import HierarchicalFab from './HierarchicalFab.tsx'
import HierarchicalHeader from './tree/HierarchicalHeader.tsx'
import HierarchicalTree from './tree/HierarchicalTree.tsx'

import type { HierarchicalTrackSelectorModel } from '../model.ts'

const AutoSizedHierarchicalTree = ({
  model,
  offset,
}: {
  model: HierarchicalTrackSelectorModel
  offset: number
}) => (
  <AutoSizer disableWidth>
    {args => <HierarchicalTree height={args.height - offset} model={model} />}
  </AutoSizer>
)

const Wrapper = ({
  overrideDimensions,
  children,
}: {
  overrideDimensions?: { width: number; height: number }
  children: React.ReactNode
}) =>
  overrideDimensions ? (
    <div style={{ ...overrideDimensions }}>{children}</div>
  ) : (
    children
  )

const HierarchicalTrackSelectorContainer = observer(
  function HierarchicalTrackSelectorContainer({
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
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
        />
        <HierarchicalFab model={model} />
      </Wrapper>
    )
  },
)

const HierarchicalTrackSelector = observer(function HierarchicalTrackSelector({
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
