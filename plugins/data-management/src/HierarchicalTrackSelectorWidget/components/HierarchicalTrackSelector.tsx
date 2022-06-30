import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { Fab, Menu, MenuItem } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
// icons
import AddIcon from '@mui/icons-material/Add'
// other
import AutoSizer from 'react-virtualized-auto-sizer'
import JBrowseMenu from '@jbrowse/core/ui/Menu'
import {
  getSession,
  isSessionModelWithWidgets,
  isSessionModelWithConnections,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { VariableSizeTree } from 'react-vtree'

// locals
import { TreeNode, HierarchicalTrackSelectorModel } from '../model'
import Header from './Header'
import Node, { MoreInfoArgs } from './Node'

const useStyles = makeStyles()(theme => ({
  fab: {
    position: 'absolute',
    bottom: theme.spacing(6),
    right: theme.spacing(6),
  },
}))

function getNodeData(
  node: TreeNode,
  nestingLevel: number,
  extra: Record<string, unknown>,
) {
  const isLeaf = !!node.conf
  return {
    data: {
      defaultHeight: isLeaf ? 22 : 40,
      isLeaf,
      isOpenByDefault: true,
      nestingLevel,
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
const HierarchicalTree = observer(
  ({
    height,
    tree,
    model,
  }: {
    height: number
    tree: TreeNode
    model: HierarchicalTrackSelectorModel
  }) => {
    const { filterText, view } = model
    const treeRef = useRef<NodeData>(null)
    const [info, setMoreInfo] = useState<MoreInfoArgs>()
    const session = getSession(model)
    const { drawerPosition } = session

    const extra = useMemo(
      () => ({
        onChange: (trackId: string) => view.toggleTrack(trackId),
        toggleCollapse: (pathName: string) => model.toggleCategory(pathName),
        onMoreInfo: setMoreInfo,
        tree,
        model,
        drawerPosition,
      }),
      [view, model, drawerPosition],
    )
    const treeWalker = useCallback(
      function* treeWalker() {
        for (let i = 0; i < tree.children.length; i++) {
          const r = tree.children[i]
          yield getNodeData(r, 0, extra)
        }

        while (true) {
          // @ts-ignore
          const parentMeta = yield

          for (let i = 0; i < parentMeta.node.children.length; i++) {
            const curr = parentMeta.node.children[i]
            yield getNodeData(curr, parentMeta.nestingLevel + 1, extra)
          }
        }
      },
      [tree, extra],
    )

    const conf = info?.conf
    const menuItems = (conf && session.getTrackActionMenuItems?.(conf)) || []

    useEffect(() => {
      // @ts-ignore
      treeRef.current.recomputeTree({
        refreshNodes: true,
        useDefaultHeight: true,
      })
    }, [tree, filterText])
    return (
      <>
        {/* @ts-ignore */}
        <VariableSizeTree ref={treeRef} treeWalker={treeWalker} height={height}>
          {/* @ts-ignore */}
          {Node}
        </VariableSizeTree>
        <JBrowseMenu
          anchorEl={info?.target}
          menuItems={menuItems}
          onMenuItemClick={(_event, callback) => {
            callback()
            setMoreInfo(undefined)
          }}
          open={Boolean(info)}
          onClose={() => setMoreInfo(undefined)}
        />
      </>
    )
  },
)

// Don't use autosizer in jest and instead hardcode a height, otherwise fails
// jest tests
const AutoSizedHierarchicalTree = ({
  tree,
  model,
  offset,
}: {
  tree: TreeNode
  model: HierarchicalTrackSelectorModel
  offset: number
}) => {
  return typeof jest === 'undefined' ? (
    <AutoSizer disableWidth>
      {({ height }) => {
        return (
          <HierarchicalTree
            height={height - offset}
            model={model}
            tree={tree}
          />
        )
      }}
    </AutoSizer>
  ) : (
    <HierarchicalTree height={9000} model={model} tree={tree} />
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
    <>{children}</>
  )
}
const HierarchicalTrackSelectorContainer = observer(
  ({
    model,
    toolbarHeight,
    overrideDimensions,
  }: {
    model: HierarchicalTrackSelectorModel
    toolbarHeight: number
    overrideDimensions?: { width: number; height: number }
  }) => {
    const { classes } = useStyles()
    const session = getSession(model)
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

    function handleFabClose() {
      setAnchorEl(null)
    }
    const hasConnections = isSessionModelWithConnections(session)
    const hasAddTrack = isSessionWithAddTracks(session)
    return (
      <Wrapper overrideDimensions={overrideDimensions}>
        <HierarchicalTrackSelector
          model={model}
          toolbarHeight={toolbarHeight}
        />
        {hasAddTrack || hasConnections ? (
          <>
            <Fab
              color="secondary"
              className={classes.fab}
              onClick={event => setAnchorEl(event.currentTarget)}
            >
              <AddIcon />
            </Fab>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
            >
              {hasConnections ? (
                <MenuItem
                  onClick={() => {
                    handleFabClose()
                    if (isSessionModelWithWidgets(session)) {
                      session.showWidget(
                        session.addWidget(
                          'AddConnectionWidget',
                          'addConnectionWidget',
                        ),
                      )
                    }
                  }}
                >
                  Add connection
                </MenuItem>
              ) : null}
              {hasAddTrack ? (
                <MenuItem
                  onClick={() => {
                    handleFabClose()
                    if (isSessionModelWithWidgets(session)) {
                      session.showWidget(
                        session.addWidget('AddTrackWidget', 'addTrackWidget', {
                          view: model.view.id,
                        }),
                      )
                    }
                  }}
                >
                  Add track
                </MenuItem>
              ) : null}
            </Menu>
          </>
        ) : null}
      </Wrapper>
    )
  },
)

const HierarchicalTrackSelector = observer(
  ({
    model,
    toolbarHeight = 0,
  }: {
    model: HierarchicalTrackSelectorModel
    toolbarHeight?: number
  }) => {
    const [assemblyIdx, setAssemblyIdx] = useState(0)
    const [headerHeight, setHeaderHeight] = useState(0)

    const { assemblyNames } = model
    const assemblyName = assemblyNames[assemblyIdx]
    return assemblyName ? (
      <>
        <Header
          model={model}
          setHeaderHeight={setHeaderHeight}
          setAssemblyIdx={setAssemblyIdx}
          assemblyIdx={assemblyIdx}
        />
        <AutoSizedHierarchicalTree
          tree={model.hierarchy(assemblyName)}
          model={model}
          offset={toolbarHeight + headerHeight}
        />
      </>
    ) : null
  },
)

export default HierarchicalTrackSelectorContainer
