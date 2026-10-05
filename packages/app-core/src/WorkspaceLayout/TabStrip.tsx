import { useEffect, useRef, useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { tabDomId, tabPanelDomId } from './panelChrome.ts'
import { tabColors, workspaceTheme } from './workspaceTheme.ts'

import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
import type { PanelNode, TabNode } from './tree.ts'

const useStyles = makeStyles()({
  strip: {
    display: 'flex',
    flexShrink: 0,
    boxSizing: 'border-box',
    height: workspaceTheme.stripHeight,
    fontSize: workspaceTheme.stripFontSize,
    background: workspaceTheme.stripBackground,
  },
  tabs: {
    display: 'flex',
    overflowX: 'auto',
    // never grow, so the `+` after the list sits beside the last tab
    flex: '0 1 auto',
    minWidth: 0,
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
    borderRight: `1px solid ${workspaceTheme.tabDivider}`,
    '&:hover .jbrowse-tab-menu': { visibility: 'visible' },
    '&:focus-within .jbrowse-tab-menu': { visibility: 'visible' },
    '&:focus-visible': {
      outline: `2px solid ${workspaceTheme.accent}`,
      outlineOffset: -2,
    },
  },
})

// Firefox reports a mouse wheel in lines (`deltaMode: 1`, `deltaY: ±3`)
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
  cellActive: boolean
}

export const TabStrip = observer(function TabStrip({
  panel,
  layout,
  chrome,
  active,
  cellActive,
}: TabStripProps) {
  const { classes } = useStyles()
  const { renderPanelActions } = chrome

  // roving tabindex; focus differs from selection because activation is manual
  const stripRef = useRef<HTMLDivElement>(null)
  const [focusedTabId, setFocusedTabId] = useState<string | undefined>(
    undefined,
  )
  const roving = panel.tabs.find(t => t.id === focusedTabId)?.id ?? active?.id

  // not an attribute selector: a nanoid needs CSS.escape, which jsdom lacks
  function tabElement(tabId: string | undefined) {
    return [...(stripRef.current?.children ?? [])].find(
      child => (child as HTMLElement).dataset.tabId === tabId,
    ) as HTMLElement | undefined
  }

  function focusTab(tabId: string) {
    setFocusedTabId(tabId)
    tabElement(tabId)?.focus()
  }

  // for a tab made current without being touched, e.g. by `+` on a full strip;
  // `block: 'nearest'` keeps it from scrolling an ancestor vertically
  useEffect(() => {
    tabElement(active?.id)?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
    })
  }, [active?.id])

  /**
   * Manual activation (arrows focus, Enter/Space selects), the WAI-ARIA
   * exception for expensive tabs: showing one mounts views that each cost
   * WebGL2 contexts.
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
    // the `tablist` inside holds only tabs, so the panel actions sit outside it
    <div
      data-tab-strip
      className={classes.strip}
      // empty strip space only, so a tab's rename double-click does not bubble
      // into a maximize
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
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusedTabId(undefined)
          }
        }}
        // translate a vertical wheel to horizontal scroll; a trackpad's larger
        // `deltaX` is already applied by the browser
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
            cellActive={cellActive}
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
  cellActive: boolean
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
  cellActive,
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
      // only the shown tab's panel is in the DOM
      aria-controls={selected ? tabPanelDomId(panel.id) : undefined}
      tabIndex={tabIndex}
      onKeyDown={event => {
        // keys from a control inside the tab belong to that control
        if (event.target === event.currentTarget) {
          onKeyDown(event, tab.id)
        }
      }}
      onFocus={() => {
        onFocus(tab.id)
      }}
      onPointerDown={event => {
        // Stops middle-button autoscroll; Pointer Events L3 still dispatches
        // the `auxclick` that closes the tab
        if (event.button === 1) {
          event.preventDefault()
          return
        }
        // only the left button activates: showing a tab mounts views
        if (event.button !== 0) {
          return
        }
        layout.setActiveTab(panel.id, tab.id)
        dragHandlers.onPointerDown(event)
      }}
      onAuxClick={event => {
        if (event.button === 1) {
          event.preventDefault()
          onTabClose?.(tab.id)
        }
      }}
      onPointerMove={dragHandlers.onPointerMove}
      onPointerUp={dragHandlers.onPointerUp}
      onPointerCancel={dragHandlers.onPointerCancel}
      onLostPointerCapture={dragHandlers.onLostPointerCapture}
      className={className}
      style={tabColors(cellActive, selected)}
    >
      {renderTabLabel(tab)}
    </div>
  )
})
