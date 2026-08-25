import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { dv, tabColors } from './dockviewTheme.ts'
import { tabDomId, tabPanelDomId } from './panelChrome.ts'

import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
import type { PanelNode, TabNode } from './tree.ts'

/**
 * A panel's tab strip: the tabs, and the panel's own buttons beside them.
 *
 * Everything with state in a cell lives here — the roving tabindex, the wheel
 * translation, the scroll-into-view — which leaves `PanelView` a pure function
 * of its node. The strip is dockview's dark theme, transcribed in
 * `dockviewTheme.ts`; see there for why it is fixed rather than derived from
 * the MUI theme.
 */

const useStyles = makeStyles()({
  strip: {
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
})

/**
 * A wheel event's delta in PIXELS.
 *
 * `deltaY` is only pixels when `deltaMode` says so. Firefox reports whole lines
 * for a mouse wheel — `deltaMode: 1`, `deltaY: ±3` — where Chrome reports
 * `deltaMode: 0`, `deltaY: ±100`. Using the raw number moves the strip three
 * pixels per notch there: scrolling, technically, and unusable in practice.
 *
 * The line height is nominal rather than measured. `getComputedStyle` per wheel
 * event to resolve a `line-height: normal` that is itself font-dependent buys
 * accuracy nobody can perceive in a scroll gesture, and the strip is a fixed
 * 35px of chrome in one size.
 */
const WHEEL_LINE_PX = 16

function wheelDeltaPixels(event: React.WheelEvent, pageSize: number) {
  switch (event.deltaMode) {
    case 1:
      return event.deltaY * WHEEL_LINE_PX
    case 2:
      return event.deltaY * pageSize
    default:
      return event.deltaY
  }
}

interface TabStripProps {
  panel: PanelNode
  layout: WorkspaceLayout
  chrome: PanelChrome
  /** the tab this panel is showing — the strip does not decide it */
  active: TabNode | undefined
  /** whether this is the cell a newly launched view lands in */
  groupActive: boolean
}

export const TabStrip = observer(function TabStrip({
  panel,
  layout,
  chrome,
  active,
  groupActive,
}: TabStripProps) {
  const { classes } = useStyles()
  const { renderPanelActions } = chrome

  // Roving tabindex: the strip is ONE tab stop, and the arrow keys move within
  // it. Focus is tracked separately from selection because activation here is
  // manual (see `onKeyDown`), so the two genuinely differ while arrowing.
  const stripRef = useRef<HTMLDivElement>(null)
  const [focusedTabId, setFocusedTabId] = useState<string | undefined>(
    undefined,
  )
  const roving = panel.tabs.find(t => t.id === focusedTabId)?.id ?? active?.id

  // by dataset rather than an interpolated attribute selector: a tab id is
  // nanoid output and would need CSS.escape, which jsdom does not have
  function tabElement(tabId: string | undefined) {
    return [...(stripRef.current?.children ?? [])].find(
      child => (child as HTMLElement).dataset.tabId === tabId,
    ) as HTMLElement | undefined
  }

  function focusTab(tabId: string) {
    setFocusedTabId(tabId)
    // focusing scrolls it into view on its own, which is the whole reason the
    // keyboard could always reach an overflowing strip when the mouse could not
    tabElement(tabId)?.focus()
  }

  /**
   * Keep the shown tab in view.
   *
   * The strip scrolls, so a tab can become current while sitting outside it —
   * `+` on a full strip appends a tab, makes it active, and leaves the user
   * looking at the tabs it scrolled past. Clicking never needs this (you
   * clicked something visible) and arrowing gets it from `focus()`, so this is
   * for the tab that becomes current without being touched.
   *
   * `block: 'nearest'` so it cannot scroll an ancestor vertically. jsdom has no
   * scrollIntoView at all, but `config/jest/scrollIntoView.js` already no-ops it
   * for the whole suite — don't add an optional call for that, it reads as a
   * browser that might not have the method.
   */
  useEffect(() => {
    tabElement(active?.id)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [active?.id])

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
  function onKeyDown(event: React.KeyboardEvent, tabId: string) {
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
    // the strip is the chrome; the `tablist` inside it is the tabs ALONE,
    // because a tablist's children have to be tabs and the panel actions beside
    // them are not
    <div
      data-tab-strip
      className={classes.strip}
      // Double-clicking the strip's empty space maximizes the cell and
      // restores it — the IDE convention, and free here because the strip's
      // only other `onDoubleClick` is the one on a tab's own label, for rename.
      //
      // `target === currentTarget` is what keeps those two apart, and it is the
      // test rather than a `stopPropagation` in `WorkspaceTab` because it holds
      // for anything ever put on the strip: a rename double-click bubbles out
      // of the label to here, and so would a double-click on the `+`.
      onDoubleClick={event => {
        if (event.target === event.currentTarget) {
          layout.toggleMaximizedPanel(panel.id)
        }
      }}
    >
      <div
        role="tablist"
        ref={stripRef}
        className={classes.tabs}
        // A mouse wheel only has a vertical axis, and this scrolls
        // horizontally — so without translating it, a strip with more tabs
        // than fit is reachable by trackpad swipe and by keyboard and NOT AT
        // ALL by mouse. The scrollbar is hidden on purpose (the strip is
        // chrome) which removes the other way of noticing there is more.
        //
        // `deltaX` is a trackpad's own horizontal axis and the browser has
        // already applied it; taking the larger axis leaves that gesture alone
        // rather than doubling it.
        onWheel={event => {
          const el = stripRef.current
          if (!el || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
            return
          }
          el.scrollLeft += wheelDeltaPixels(event, el.clientWidth)
        }}
      >
        {panel.tabs.map(tab => (
          <Tab
            key={tab.id}
            tab={tab}
            panel={panel}
            layout={layout}
            chrome={chrome}
            className={classes.tab}
            selected={tab.id === active?.id}
            groupActive={groupActive}
            tabIndex={tab.id === roving ? 0 : -1}
            onKeyDown={onKeyDown}
            onFocus={setFocusedTabId}
          />
        ))}
      </div>
      {renderPanelActions?.(panel)}
    </div>
  )
})

interface TabProps {
  tab: TabNode
  panel: PanelNode
  layout: WorkspaceLayout
  chrome: PanelChrome
  className: string
  selected: boolean
  groupActive: boolean
  tabIndex: number
  onKeyDown: (event: React.KeyboardEvent, tabId: string) => void
  onFocus: (tabId: string) => void
}

const Tab = observer(function Tab({
  tab,
  panel,
  layout,
  chrome,
  className,
  selected,
  groupActive,
  tabIndex,
  onKeyDown,
  onFocus,
}: TabProps) {
  const { renderTabLabel, dragHandlers, onTabClose } = chrome
  return (
    <div
      role="tab"
      id={tabDomId(tab.id)}
      data-tab-id={tab.id}
      aria-selected={selected}
      // only the shown tab has a panel in the DOM to control — the rest are not
      // rendered, so pointing at an absent id would be a lie
      aria-controls={selected ? tabPanelDomId(panel.id) : undefined}
      tabIndex={tabIndex}
      onKeyDown={event => {
        onKeyDown(event, tab.id)
      }}
      onFocus={() => {
        onFocus(tab.id)
      }}
      onPointerDown={event => {
        // The middle button closes rather than drags, and its default action is
        // the browser's autoscroll — which would otherwise start the moment a
        // tab is middle-pressed.
        //
        // Cancelling pointerdown suppresses the compatibility mouse events
        // (which is what stops the autoscroll) and NOT `click` / `auxclick`:
        // Pointer Events L3 dispatches those two independently of that mapping.
        // So the close below still fires, which is the thing this looks like it
        // would break.
        if (event.button === 1) {
          event.preventDefault()
          return
        }
        // Showing a tab is expensive — it mounts a stack of views, each display
        // costing a WebGL2 context — so it is the LEFT button that asks for it,
        // the same gate dockview puts on `_activateOnPointerDown`. A right-press
        // is on its way to a context menu and is not a request to look at
        // anything.
        if (event.button !== 0) {
          return
        }
        layout.setActiveTab(panel.id, tab.id)
        dragHandlers.onTabPointerDown(tab.id, event)
      }}
      onAuxClick={event => {
        if (event.button === 1) {
          event.preventDefault()
          onTabClose?.(tab.id)
        }
      }}
      onPointerMove={dragHandlers.onTabPointerMove}
      onPointerUp={dragHandlers.onTabPointerUp}
      onPointerCancel={dragHandlers.onTabPointerCancel}
      className={className}
      style={tabColors(groupActive, selected)}
    >
      {renderTabLabel(tab)}
    </div>
  )
})
