import { createElementId } from '@jbrowse/core/util/types/mst'

import { isSessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

import type { DockviewSessionType } from './types.ts'
import type {
  DockviewLayoutNode,
  SessionWithDockviewLayout,
} from '../../DockviewLayout/index.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type { DockviewApi, DockviewGroupPanel } from 'dockview-react'

export function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType | undefined,
): AbstractViewModel[] {
  if (!session || !isSessionWithDockviewLayout(session)) {
    return []
  }
  const viewIds = session.getViewIdsForPanel(panelId)
  return viewIds
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)
}

export function createPanelConfig(
  panelId: string,
  session: DockviewSessionType,
  title = 'Main',
) {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
    title,
    params: { panelId, session },
  }
}

/**
 * Blank each panel's `params` before persisting. `params.session` is a live MST
 * node, so leaving it in would make `toJSON()` serialize the whole session into
 * the layout that is itself stored on that session (a circular snapshot).
 * `updatePanelParams` re-injects the session on restore.
 */
export function cleanLayoutForStorage(
  layout: ReturnType<DockviewApi['toJSON']>,
): ReturnType<DockviewApi['toJSON']> {
  return {
    ...layout,
    panels: Object.fromEntries(
      Object.entries(layout.panels).map(([id, panel]) => [
        id,
        { ...panel, params: {} },
      ]),
    ),
  }
}

export function updatePanelParams(
  api: DockviewApi,
  session: DockviewSessionType,
) {
  for (const panel of api.panels) {
    panel.update({ params: { panelId: panel.id, session } })
  }
}

export function getPanelPosition(
  group: DockviewGroupPanel | undefined,
  direction?: 'right' | 'below',
) {
  if (!group) {
    return undefined
  }
  if (direction) {
    return { referenceGroup: group, direction }
  }
  return { referenceGroup: group }
}

/**
 * Build dockview panels/groups from a nested init layout (e.g. from URL
 * params), assigning each node's views to its panel and tracking them. Returns
 * the first panel's ID so the caller can mark it active.
 */
export function applyInitLayout(
  api: DockviewApi,
  session: DockviewSessionType & SessionWithDockviewLayout,
  initLayout: DockviewLayoutNode,
  trackedViewIds: Set<string>,
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
      const panelId = `panel-${createElementId()}`
      if (!firstPanelId) {
        firstPanelId = panelId
      }
      api.addPanel({
        ...createPanelConfig(panelId, session, 'Tab'),
        position: getPanelPosition(referenceGroup, direction),
      })
      for (const viewId of node.viewIds) {
        session.assignViewToPanel(panelId, viewId)
        trackedViewIds.add(viewId)
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
