import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { dv, tabColors } from './dockviewTheme.ts'
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
 *
 * The colours are dockview's dark theme, transcribed in `dockviewTheme.ts` —
 * see there for why they are fixed rather than derived from the MUI theme.
 */

const useStyles = makeStyles()({
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
    background: dv.groupBackground,
  },
  tabStrip: {
    display: 'flex',
    flexShrink: 0,
    boxSizing: 'border-box',
    height: dv.tabsHeight,
    fontSize: dv.tabsFontSize,
    background: dv.tabsBackground,
  },
  tabs: {
    display: 'flex',
    overflowX: 'auto',
    flex: 1,
    minWidth: 0,
    // the strip is chrome, so a scrollbar across it would be noise
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': { display: 'none' },
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    boxSizing: 'border-box',
    maxWidth: 240,
    padding: '0.25rem 0.5rem',
    cursor: 'pointer',
    userSelect: 'none',
    touchAction: 'none',
    borderRight: `1px solid ${dv.tabDividerColor}`,
    '&:hover .jbrowse-tab-menu': { visibility: 'visible' },
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
    // above this panel's own content and nothing else — the panel is
    // position:relative, so an app-wide z-index would let it cover menus
    zIndex: 1,
    background: dv.dragOverBackground,
    outline: `1px solid ${dv.edgeDockIndicatorColor}`,
  },
})

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
  const groupActive = layout.activePanelId === panel.id

  return (
    <div
      data-panel-id={panel.id}
      className={classes.panel}
      onPointerDownCapture={() => {
        // clicking anywhere in a cell makes it the one a new view lands in.
        // Capture, so it still registers when the click is consumed by a
        // control inside the view.
        if (!groupActive) {
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
              className={classes.tab}
              style={tabColors(groupActive, tab.id === active?.id)}
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
