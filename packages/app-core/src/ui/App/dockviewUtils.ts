import { createElementId } from '@jbrowse/core/util/types/mst'

import type { DockviewSessionType } from './types.ts'
import type {
  DockviewLayoutNode,
  SessionWithDockviewLayout,
} from '../../DockviewLayout/index.ts'
import type { AbstractViewModel } from '@jbrowse/core/util'
import type {
  DockviewApi,
  DockviewGroupPanel,
  SerializedDockview,
} from 'dockview-react'

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
  return session
    .getViewIdsForPanel(panelId)
    .map(id => session.views.find(v => v.id === id))
    .filter((v): v is AbstractViewModel => v !== undefined)
}

// No `title`: an unset title makes JBrowseViewTab derive the tab name from the
// panel's views (see getTabDisplayName). A title is only ever set when the user
// explicitly renames a tab via api.setTitle.
export function createPanelConfig(
  panelId: string,
  session: DockviewSessionType & SessionWithDockviewLayout,
) {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
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
  session: DockviewSessionType & SessionWithDockviewLayout,
) {
  for (const panel of api.panels) {
    panel.update({ params: { panelId: panel.id, session } })
  }
}

/**
 * Serialize the live layout for persistence. Pairs `toJSON` with the
 * param-stripping of `cleanLayoutForStorage` so a layout can never be persisted
 * with the live MST session embedded in it (which would be a circular snapshot).
 */
export function serializeLayout(api: DockviewApi) {
  return cleanLayoutForStorage(api.toJSON())
}

/**
 * Restore a persisted layout and re-inject the live session in one step.
 * `fromJSON` alone would leave every panel with the blanked params produced by
 * `serializeLayout` (no session -> permanent "Loading..."), so the restore and
 * the `updatePanelParams` re-injection always travel together.
 */
export function restoreLayout(
  api: DockviewApi,
  session: DockviewSessionType & SessionWithDockviewLayout,
  layout: SerializedDockview,
) {
  api.fromJSON(layout)
  updatePanelParams(api, session)
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
        ...createPanelConfig(panelId, session),
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
