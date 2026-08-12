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

export interface PanelViewProps {
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
  const active =
    panel.tabs.find(t => t.id === panel.activeTabId) ?? panel.tabs[0]

  return (
    <div
      data-panel-id={panel.id}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
      onPointerDownCapture={() => {
        // clicking anywhere in a cell makes it the one a new view lands in.
        // Capture, so it still registers when the click is consumed by a
        // control inside the view.
        if (layout.activePanelId !== panel.id) {
          layout.setActivePanelId(panel.id)
        }
      }}
    >
      <div
        role="tablist"
        style={{ display: 'flex', alignItems: 'center', flex: '0 0 auto' }}
      >
        <div style={{ display: 'flex', overflowX: 'auto', flex: 1 }}>
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

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {active ? renderTabContent(active) : null}
      </div>

      {dropZone ? <DropIndicator zone={dropZone} /> : null}
    </div>
  )
})

/**
 * Where the tab would land if released now. Half the cell for an edge, the
 * whole cell for a tab drop — the same shape dockview draws, because it reads
 * unambiguously and users already know it.
 */
const DropIndicator = observer(function DropIndicator({
  zone,
}: {
  zone: DropZone
}) {
  return (
    <div
      data-drop-indicator={zone}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(64,128,255,0.30)',
        outline: '1px solid rgba(64,128,255,0.8)',
        ...indicatorRect(zone),
      }}
    />
  )
})
