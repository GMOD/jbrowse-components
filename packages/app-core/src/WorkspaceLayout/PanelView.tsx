import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import { indicatorRect } from './dropZone.ts'

import type { DropZone } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'
import type { PanelNode, TabNode } from './tree.ts'
import type { TabDragHandlers } from './useLayoutDrag.ts'

/**
 * One cell of the grid: a tab strip, and the content of whichever tab is
 * showing.
 *
 * The strip's structure is layout and lives here; what a tab is *called* and
 * what it *contains* are the app's, and arrive as render props. That split is
 * why this file knows nothing about JBrowse views.
 */

const useStyles = makeStyles()(theme => ({
  // `flex: 1` and `minWidth: 0` are load-bearing, not tidiness. This is a child
  // of a `display: flex` row, so without them its width is its CONTENT's width
  // — and a view measures its container to decide how wide to draw
  // (useWidthSetter), so the two settle at the view's intrinsic width and the
  // panel renders at half the window with dead space beside it.
  panel: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    background: theme.palette.background.default,
  },
  tabStrip: {
    display: 'flex',
    alignItems: 'stretch',
    flex: '0 0 auto',
    minHeight: 28,
    background: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tabs: {
    display: 'flex',
    alignItems: 'stretch',
    overflowX: 'auto',
    flex: 1,
    minWidth: 0,
    // the strip is chrome, so a horizontal scrollbar in it would be noise
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
  },
  indicator: {
    position: 'absolute',
    pointerEvents: 'none',
    // the panel is position:relative, so 1 is above its content and nothing
    // else — an app-wide z-index would let it cover menus and dialogs
    zIndex: 1,
    background: alpha(theme.palette.primary.main, 0.3),
    outline: `1px solid ${theme.palette.primary.main}`,
  },
}))

interface PanelViewProps {
  panel: PanelNode
  layout: WorkspaceLayout
  renderTabLabel: (tab: TabNode) => React.ReactNode
  renderTabContent: (tab: TabNode) => React.ReactNode
  /** the panel's own buttons — new tab, split, close */
  renderPanelActions?: (panel: PanelNode) => React.ReactNode
  dragHandlers: TabDragHandlers
  dropZone?: DropZone
}

export const PanelView = observer(function PanelView({
  panel,
  layout,
  renderTabLabel,
  renderTabContent,
  renderPanelActions,
  dragHandlers,
  dropZone,
}: PanelViewProps) {
  const { classes } = useStyles()
  const active =
    panel.tabs.find(t => t.id === panel.activeTabId) ?? panel.tabs[0]

  return (
    <div
      data-panel-id={panel.id}
      className={classes.panel}
      onPointerDownCapture={() => {
        // clicking anywhere in a cell makes it the one a new view lands in.
        // Capture, so it still registers when the click is consumed by a
        // control inside the view.
        if (layout.activePanelId !== panel.id) {
          layout.setActivePanelId(panel.id)
        }
      }}
    >
      <div role="tablist" className={classes.tabStrip}>
        <div className={classes.tabs}>
          {panel.tabs.map(tab => (
            <div
              key={tab.id}
              role="tab"
              data-tab-id={tab.id}
              aria-selected={tab.id === active?.id}
              onPointerDown={event => {
                layout.setActiveTab(panel.id, tab.id)
                dragHandlers.onTabPointerDown(tab.id, event)
              }}
              onPointerMove={dragHandlers.onTabPointerMove}
              onPointerUp={dragHandlers.onTabPointerUp}
              style={{ touchAction: 'none', cursor: 'pointer' }}
            >
              {renderTabLabel(tab)}
            </div>
          ))}
        </div>
        {renderPanelActions?.(panel)}
      </div>

      <div className={classes.content}>
        {active ? renderTabContent(active) : null}
      </div>

      {dropZone ? (
        <div
          data-drop-indicator={dropZone}
          className={classes.indicator}
          style={indicatorRect(dropZone)}
        />
      ) : null}
    </div>
  )
})
