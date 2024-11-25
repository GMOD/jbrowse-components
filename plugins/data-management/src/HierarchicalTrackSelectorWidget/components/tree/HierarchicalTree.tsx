import React, { useCallback, useMemo, useRef, useEffect } from 'react'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { VariableSizeTree } from 'react-vtree'
// locals
import Node from './TrackListNode'
import type { TreeNode } from '../../generateHierarchy'
import type { HierarchicalTrackSelectorModel } from '../../model'

function getNodeData(
  node: TreeNode,
  nestingLevel: number,
  extra: Record<string, unknown>,
  selection: Record<string, unknown>,
) {
  const isLeaf = node.type === 'track'
  const selected = isLeaf ? selection[node.trackId] : false
  return {
    data: {
      defaultHeight: isLeaf ? 22 : 40,
      isLeaf,
      isOpenByDefault: true,
      nestingLevel,
      selected,
      ...node,
      ...extra,
    },
    nestingLevel,
    node,
  }
}

type NodeData = ReturnType<typeof getNodeData>

// this is the main tree component for the hierarchical track selector in note:
// in jbrowse-web the toolbar is position="sticky" which means the autosizer
// includes the height of the toolbar, so we subtract the given offsets
const HierarchicalTree = observer(function HierarchicalTree({
  height,
  tree,
  model,
}: {
  height: number
  tree: TreeNode
  model: HierarchicalTrackSelectorModel
}) {
  const { filterText, selection, view } = model
  const treeRef = useRef<NodeData>(null)
  const session = getSession(model)
  const { drawerPosition } = session
  const obj = useMemo(
    () => Object.fromEntries(selection.map(s => [s.trackId, s])),
    [selection],
  )

  const extra = useMemo(
    () => ({
      onChange: (trackId: string) => {
        const trackTurnedOn = view.toggleTrack(trackId)
        if (trackTurnedOn) {
          model.addToRecentlyUsed(trackId)
        }
      },
      toggleCollapse: (pathName: string) => {
        model.toggleCategory(pathName)
      },
      tree,
      model,
      drawerPosition,
    }),
    [view, model, drawerPosition, tree],
  )

  // doing this properly without ts-expect-error is tricky, react-vtree has
  // some typescript examples that could help
  const treeWalker = useCallback(
    // @ts-expect-error
    function* treeWalker() {
      for (const child of tree.children) {
        yield getNodeData(child, 0, extra, obj)
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        // @ts-expect-error
        const parentMeta = yield

        // @ts-expect-error
        for (const curr of parentMeta.node.children) {
          yield getNodeData(curr, parentMeta.nestingLevel + 1, extra, obj)
        }
      }
    },
    [tree, extra, obj],
  )

  /* biome-ignore lint/correctness/useExhaustiveDependencies: */
  useEffect(() => {
    // @ts-expect-error
    treeRef.current.recomputeTree({
      refreshNodes: true,
      useDefaultHeight: true,
    })
  }, [tree, filterText])
  return (
    <>
      {/* @ts-expect-error */}
      <VariableSizeTree ref={treeRef} treeWalker={treeWalker} height={height}>
        {/* @ts-expect-error */}
        {Node}
      </VariableSizeTree>
    </>
  )
})

export default HierarchicalTree
