import { createElementId } from '@jbrowse/core/util/types/mst'

import type { DockviewSessionType } from './types.ts'
import type {
  DockviewLayoutNode,
  SessionWithDockviewLayout,
} from '../../DockviewLayout/index.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

/**
 * Single source of truth for the panel-id format. Every panel id is created
 * here, so the `panel-` prefix never has to be reproduced by hand. JBrowseViewTab
 * relies on a panel's id being a stable, unique string to tell an auto-named tab
 * (title === id, see dockview's `state.title ?? this.id` restore) from a
 * user-renamed one.
 */
export function createPanelId() {
  return `panel-${createElementId()}`
}

export function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType & SessionWithDockviewLayout,
): AbstractViewModel[] {
  return session.getViewIdsForPanel(panelId).flatMap(id => {
    const view = session.views.find(v => v.id === id)
    return view ? [view] : []
  })
}

/**
 * Reconcile session views against dockview panels: assign any view lacking a
 * panel to the active panel (creating one if there are none), then drop
 * assignments for views that no longer exist. Runs inside an autorun in
 * TiledViewsContainer whenever the view list or assignments change.
 */
export function reconcilePanelAssignments(
  api: DockviewApi,
  session: DockviewSessionType & SessionWithDockviewLayout,
) {
  const currentViewIds = new Set(session.views.map(v => v.id))

  for (const view of session.views) {
    if (!session.getPanelContainingView(view.id)) {
      let activePanelId = session.activePanelId
      if (!activePanelId || !api.getPanel(activePanelId)) {
        const firstPanel = api.panels[0]
        if (firstPanel) {
          activePanelId = firstPanel.id
        } else {
          activePanelId = createPanelId()
          api.addPanel(createPanelConfig(activePanelId))
        }
        session.setActivePanelId(activePanelId)
      }
      session.assignViewToPanel(activePanelId, view.id)
    }
  }

  for (const id of [...session.panelViewAssignments.values()].flat()) {
    if (!currentViewIds.has(id)) {
      session.removeViewFromPanel(id)
    }
  }
}

// No `title`: an unset title makes JBrowseViewTab derive the tab name from the
// panel's views (see getTabDisplayName). A title is only ever set when the user
// explicitly renames a tab via api.setTitle.
//
// `params` carries only the panelId (a plain string), so the layout serializes
// cleanly via api.toJSON() with no live MST session embedded (which would be a
// circular snapshot). Panel/tab components read the live session from
// DockviewContext instead.
export function createPanelConfig(panelId: string) {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
    params: { panelId },
  }
}

export function getPanelPosition(
  group: DockviewGroupPanel | undefined,
  direction?: 'right' | 'below',
) {
  return group
    ? { referenceGroup: group, ...(direction ? { direction } : {}) }
    : undefined
}

/**
 * Build dockview panels/groups from a nested init layout (e.g. from URL
 * params), assigning each node's views to its panel. Returns the first panel's
 * ID so the caller can mark it active.
 */
export function applyInitLayout(
  api: DockviewApi,
  session: DockviewSessionType & SessionWithDockviewLayout,
  initLayout: DockviewLayoutNode,
) {
  let firstPanelId: string | undefined
  const groupSizes: { group: DockviewGroupPanel; size: number }[] = []

  function processNode(
    node: DockviewLayoutNode | undefined,
    referenceGroup: DockviewGroupPanel | undefined,
    direction: 'right' | 'below' | undefined,
  ): DockviewGroupPanel | undefined {
    if (!node) {
      return undefined
    }
    if (node.viewIds !== undefined) {
      const panelId = createPanelId()
      if (!firstPanelId) {
        firstPanelId = panelId
      }
      api.addPanel({
        ...createPanelConfig(panelId),
        position: getPanelPosition(referenceGroup, direction),
      })
      for (const viewId of node.viewIds) {
        session.assignViewToPanel(panelId, viewId)
      }
      const group = api.getPanel(panelId)?.group
      if (group && node.size !== undefined) {
        groupSizes.push({ group, size: node.size })
      }
      return group
    }
    if (node.children && node.children.length > 0) {
      const dockviewDirection =
        node.direction === 'horizontal' ? 'right' : 'below'
      let currentGroup = referenceGroup
      for (let i = 0; i < node.children.length; i++) {
        const childDirection = i === 0 ? direction : dockviewDirection
        const childRef = i === 0 ? referenceGroup : currentGroup
        const newGroup = processNode(node.children[i], childRef, childDirection)
        if (newGroup) {
          currentGroup = newGroup
        }
      }
      return currentGroup
    }
    return undefined
  }

  processNode(initLayout, undefined, undefined)

  if (
    groupSizes.length >= 2 &&
    initLayout.direction &&
    groupSizes.length === initLayout.children?.length
  ) {
    const dimension = initLayout.direction === 'horizontal' ? 'width' : 'height'
    requestAnimationFrame(() => {
      const totalSize = groupSizes.reduce((sum, g) => sum + g.size, 0)
      const containerSize = dimension === 'width' ? api.width : api.height
      if (totalSize > 0 && containerSize > 0) {
        for (const { group, size } of groupSizes) {
          const px = Math.round(containerSize * (size / totalSize))
          group.api.setSize(
            dimension === 'width' ? { width: px } : { height: px },
          )
        }
      }
    })
  }

  return firstPanelId
}

export function rearrangePanelsWithDirection(
  api: DockviewApi,
  getPosition: (
    idx: number,
    panelStates: { id: string }[],
  ) =>
    | { referencePanel: string; direction: 'right' | 'below' | 'within' }
    | undefined,
) {
  const panels = api.panels
  if (panels.length <= 1) {
    return
  }

  const panelStates = panels.map(p => ({
    id: p.id,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
    title: p.title,
    params: p.params,
  }))

  for (const p of panels) {
    api.removePanel(p)
  }
  for (const [idx, state] of panelStates.entries()) {
    api.addPanel({
      ...state,
      position: getPosition(idx, panelStates),
    })
  }
}
