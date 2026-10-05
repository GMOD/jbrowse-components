import { persistentScrollbarStyle } from '@jbrowse/core/ui/persistentScrollbarStyle'
import { useScrollPortHeightVar } from '@jbrowse/core/util/hooks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { TabStrip } from './TabStrip.tsx'
import { indicatorRect } from './dropZone.ts'
import { tabDomId, tabPanelDomId } from './panelChrome.ts'
import { activeTabIn } from './tree.ts'
import { workspaceTheme } from './workspaceTheme.ts'

import type { DropTarget } from './dropZone.ts'
import type { WorkspaceLayout } from './model.ts'
import type { PanelChrome } from './panelChrome.ts'
import type { PanelNode, TabNode } from './tree.ts'

const useStyles = makeStyles()(theme => ({
  // without `flex: 1` and `minWidth: 0` the cell takes its content's width, and
  // a view sizes itself to its container, so both settle too narrow
  panel: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    // below the strip the cell follows the app theme, not `workspaceTheme`
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
    // local to the position:relative panel, so it cannot cover menus
    zIndex: 1,
    background: workspaceTheme.dropWash,
    outline: `1px solid ${workspaceTheme.accent}`,
  },
  caret: {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 1,
    top: 0,
    width: 2,
    height: workspaceTheme.stripHeight,
    background: workspaceTheme.accent,
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

  return (
    <div
      data-panel-id={panel.id}
      className={classes.panel}
      onPointerDownCapture={() => {
        // capture phase, so a control inside the view that consumes the click
        // still activates the cell
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
        cellActive={layout.activePanelId === panel.id}
      />

      {active ? (
        <TabPanel
          key={active.id}
          panelId={panel.id}
          tab={active}
          chrome={chrome}
          className={classes.content}
        />
      ) : (
        <div role="tabpanel" className={classes.content} />
      )}

      <DropIndicator drop={drop} classes={classes} />
    </div>
  )
})

// keyed by tab, so a switch gets a fresh ViewStack and scroll port
const TabPanel = observer(function TabPanel({
  panelId,
  tab,
  chrome,
  className,
}: {
  panelId: string
  tab: TabNode
  chrome: PanelChrome
  className: string
}) {
  const ref = useScrollPortHeightVar()
  return (
    <div
      role="tabpanel"
      id={tabPanelDomId(panelId)}
      aria-labelledby={tabDomId(tab.id)}
      className={className}
      ref={ref}
    >
      {chrome.renderTabContent(tab)}
    </div>
  )
})

/** Where a drop would land: a caret at a strip gap, or a wash over a zone. */
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
        // a scrolled strip's first gap is left of the panel, which does not clip
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
