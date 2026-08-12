import { useRef, useState } from 'react'

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
 * The strip is dockview's dark theme, transcribed in `dockviewTheme.ts` — see
 * there for why it is fixed rather than derived from the MUI theme. The line
 * between the two is the strip's lower edge: everything above it is chrome and
 * is dark in either JBrowse theme, everything below it is content and follows
 * the theme.
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
    // shrink but never GROW: the panel actions are the next child of the strip,
    // so a tab list that takes the leftover space pushes the `+` to the far
    // right edge, arbitrarily far from the tab it acts on. `0 1 auto` sizes the
    // list to its tabs and leaves the `+` beside the last one, and the shrink
    // half is what makes it scroll here rather than push the `+` off the strip.
    flex: '0 1 auto',
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
    // a keyboard user needs the ⋮ too, and hover is not a thing they can do
    '&:focus-within .jbrowse-tab-menu': { visibility: 'visible' },
    // the strip is dark in either theme, so the focus ring is the drop
    // indicator's blue rather than the UA default black-on-dark
    '&:focus-visible': {
      outline: `2px solid ${dv.edgeDockIndicatorColor}`,
      outlineOffset: -2,
    },
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

/**
 * The tab strip is a `tablist`, so the ids it wires `aria-controls` /
 * `aria-labelledby` with have to be DOM ids. Tab ids are `types.identifier` and
 * so unique within the tree, which is what makes prefixing them enough.
 */
const tabDomId = (tabId: string) => `jbrowse-tab-${tabId}`
const tabPanelDomId = (panelId: string) => `jbrowse-tabpanel-${panelId}`

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

  // Roving tabindex: the strip is ONE tab stop, and the arrow keys move within
  // it. Focus is tracked separately from selection because activation here is
  // manual (see below), so the two genuinely differ while arrowing.
  const stripRef = useRef<HTMLDivElement>(null)
  const [focusedTabId, setFocusedTabId] = useState<string | undefined>(
    undefined,
  )
  const roving = panel.tabs.find(t => t.id === focusedTabId)?.id ?? active?.id

  function focusTab(tabId: string) {
    setFocusedTabId(tabId)
    // by dataset rather than an interpolated attribute selector: a tab id is
    // nanoid output and would need CSS.escape, which jsdom does not have
    const el = [...(stripRef.current?.children ?? [])].find(
      child => (child as HTMLElement).dataset.tabId === tabId,
    )
    ;(el as HTMLElement | undefined)?.focus()
  }

  /**
   * MANUAL activation: arrows move focus, Enter/Space selects.
   *
   * The automatic form (arrowing selects as it goes) is the more common reading
   * of the tabs pattern, and is wrong here for the reason WAI-ARIA names as its
   * exception — showing a tab is expensive. Only the selected tab's views are
   * mounted, and a JBrowse view costs a WebGL2 context per display against a
   * ceiling of 16, so arrowing across five tabs would build and tear down five
   * sets of them to pass through.
   */
  function onTabKeyDown(event: React.KeyboardEvent, tabId: string) {
    const ids = panel.tabs.map(t => t.id)
    const i = ids.indexOf(tabId)
    const step =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    let next: string | undefined
    if (step !== 0) {
      next = ids[(i + step + ids.length) % ids.length]
    } else if (event.key === 'Home') {
      next = ids[0]
    } else if (event.key === 'End') {
      next = ids.at(-1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      layout.setActiveTab(panel.id, tabId)
      return
    }
    if (next !== undefined) {
      event.preventDefault()
      focusTab(next)
    }
  }

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
      {/* the strip is the chrome; the `tablist` inside it is the tabs ALONE,
          because a tablist's children have to be tabs and the panel actions
          beside them are not */}
      <div data-tab-strip className={classes.tabStrip}>
        <div role="tablist" ref={stripRef} className={classes.tabs}>
          {panel.tabs.map(tab => (
            <div
              key={tab.id}
              role="tab"
              id={tabDomId(tab.id)}
              data-tab-id={tab.id}
              aria-selected={tab.id === active?.id}
              // only the shown tab has a panel in the DOM to control — the rest
              // are not rendered, so pointing at an absent id would be a lie
              aria-controls={
                tab.id === active?.id ? tabPanelDomId(panel.id) : undefined
              }
              tabIndex={tab.id === roving ? 0 : -1}
              onKeyDown={event => {
                onTabKeyDown(event, tab.id)
              }}
              onFocus={() => {
                setFocusedTabId(tab.id)
              }}
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

      <div
        role="tabpanel"
        id={tabPanelDomId(panel.id)}
        // no tabIndex: the WAI pattern adds one only for a panel with nothing
        // focusable inside, and a tab here holds views full of controls (an
        // empty one holds the launcher's buttons)
        aria-labelledby={active ? tabDomId(active.id) : undefined}
        className={classes.content}
      >
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
