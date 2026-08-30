import { persistentScrollbarStyle } from '@jbrowse/core/ui/persistentScrollbarStyle'
import { useScrollPortHeightVar } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { TabStrip } from './TabStrip.tsx'
import { dv } from './dockviewTheme.ts'
import { indicatorRect } from './dropZone.ts'
import { tabDomId, tabPanelDomId } from './panelChrome.ts'
import { activeTabIn } from './tree.ts'

import type { DropTarget } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
import type { PanelNode } from './tree.ts'

/**
 * One cell of the grid: a tab strip, and the content of whichever tab is
 * showing.
 *
 * The strip and its state are `TabStrip`; this is the frame around them, and
 * has no state of its own — it is a function of its node, which is the whole
 * point of the layout being one MST tree.
 *
 * The line between chrome and content is the strip's lower edge: everything
 * above it is dockview's dark theme in either JBrowse theme (see
 * `dockviewTheme.ts`), everything below it follows the app's.
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
    // the surface the views sit on, so it is the app's background and not
    // dockview's — see `dockviewTheme.ts`. A cell is taller than its views
    // whenever they don't fill it, so this is most of what a panel shows.
    background: theme.palette.background.default,
  },
  content: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'auto',
    ...persistentScrollbarStyle(theme),
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
  // where a tab dragged onto the strip would land
  caret: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 1,
    top: 0,
    width: 2,
    height: dv.tabsHeight,
    background: dv.edgeDockIndicatorColor,
  },
}))

interface PanelViewProps {
  panel: PanelNode
  layout: WorkspaceLayout
  chrome: PanelChrome
  /** where an in-flight drag would land in THIS cell, if it is over this one */
  drop?: DropTarget
}

export const PanelView = observer(function PanelView({
  panel,
  layout,
  chrome,
  drop,
}: PanelViewProps) {
  const { classes } = useStyles()
  const active = activeTabIn(panel)
  const contentRef = useScrollPortHeightVar()

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
      <TabStrip
        panel={panel}
        layout={layout}
        chrome={chrome}
        active={active}
        groupActive={layout.activePanelId === panel.id}
      />

      <div
        role="tabpanel"
        id={tabPanelDomId(panel.id)}
        // no tabIndex: the WAI pattern adds one only for a panel with nothing
        // focusable inside, and a tab here holds views full of controls (an
        // empty one holds the launcher's buttons)
        aria-labelledby={active ? tabDomId(active.id) : undefined}
        className={classes.content}
        ref={contentRef}
      >
        {active ? chrome.renderTabContent(active) : null}
      </div>

      <DropIndicator drop={drop} classes={classes} />
    </div>
  )
})

/**
 * Where a drop would land, drawn over the cell.
 *
 * A strip drop gets a caret at the gap rather than a wash over half the cell:
 * it is a position in the tab order, and shading half the panel would say
 * "split this cell", which is the wrong thing.
 */
const DropIndicator = observer(function DropIndicator({
  drop,
  classes,
}: {
  drop?: DropTarget
  classes: { indicator: string; caret: string }
}) {
  if (drop?.strip) {
    return (
      <div
        data-drop-caret={drop.strip.index}
        className={classes.caret}
        // A scrolled strip's left-most gap has a negative panel-relative x, and
        // the panel has no `overflow: hidden` — the caret drew into the
        // neighbour. Clamped here because `stripDropAt` is deliberately
        // ignorant of which coordinate space it was handed, so it cannot know
        // where zero is.
        style={{ left: Math.max(0, drop.strip.left) }}
      />
    )
  }
  return drop ? (
    <div
      data-drop-indicator={drop.zone}
      className={classes.indicator}
      style={indicatorRect(drop.zone)}
    />
  ) : null
})
