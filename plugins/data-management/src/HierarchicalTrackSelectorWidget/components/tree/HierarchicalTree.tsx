import React, { useCallback, useMemo, useRef, useEffect } from 'react'
import { observer } from 'mobx-react'
import { VariableSizeTree } from 'react-vtree'
import { getSession } from '@jbrowse/core/util'
// locals
import { TreeNode, HierarchicalTrackSelectorModel } from '../../model'
import Node from './TrackListNode'

function getNodeData(
  node: TreeNode,
  nestingLevel: number,
  extra: Record<string, unknown>,
  selection: Record<string, unknown>,
) {
  const isLeaf = !!node.conf
  const selected = !!selection[node.id]
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
export default observer(function HierarchicalTree({
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
      onChange: (trackId: string) => view.toggleTrack(trackId),
      toggleCollapse: (pathName: string) => model.toggleCategory(pathName),
      tree,
      model,
      drawerPosition,
    }),
    [view, model, drawerPosition, tree],
  )
  const treeWalker = useCallback(
    function* treeWalker() {
      for (let i = 0; i < tree.children.length; i++) {
        const r = tree.children[i]
        yield getNodeData(r, 0, extra, obj)
      }

      while (true) {
        // @ts-expect-error
        const parentMeta = yield

        for (let i = 0; i < parentMeta.node.children.length; i++) {
          const curr = parentMeta.node.children[i]
          yield getNodeData(curr, parentMeta.nestingLevel + 1, extra, obj)
        }
      }
    },
    [tree, extra, obj],
  )

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
