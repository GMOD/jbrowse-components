import { createElementId } from '@jbrowse/core/util/types/mst'

import type {
  DockviewLayoutNode,
  SessionWithDockviewLayout,
} from '../../DockviewLayout/index.ts'
import type { DockviewSessionType } from './types.ts'
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

/**
 * The views a panel renders, in `session.views` order.
 *
 * **`session.views` is the one ordering of views; a panel assignment says which
 * panel a view is in, not where in it.** This used to read the order off the
 * assignment array, which made the two properties independent and put the same
 * fact in two places — so "move this view up" had two implementations picked by
 * layout mode, and an operation underneath that fork (replaceView, which puts a
 * new view where an old one was) could not express itself to whichever ordering
 * happened to be live. Ordering here, grouping there, and each is stated once.
 */
export function getViewsForPanel(
  panelId: string,
  session: DockviewSessionType & SessionWithDockviewLayout,
): AbstractViewModel[] {
  const ids = new Set(session.getViewIdsForPanel(panelId))
  return session.views.filter(v => ids.has(v.id))
}

/**
 * dockview serializes its grid to a fresh object every call, so identity
 * comparison never holds — compare by value. Both sides originate from
 * `api.toJSON()` (the session's copy having at most round-tripped through a
 * snapshot), so key order is stable and stringify is a sound deep-equal.
 */
export function layoutsEqual(
  a: SerializedDockview | undefined,
  b: SerializedDockview | undefined,
) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Reconcile session views against dockview panels: drop assignments that can no
 * longer render, then home any view left without a panel. Runs inside the
 * sync autorun in useDockviewController, after the persisted layout has been
 * applied — so `api` holds the panels the session's own layout describes.
 */
export function reconcilePanelAssignments(
  api: DockviewApi,
  session: DockviewSessionType & SessionWithDockviewLayout,
) {
  const currentViewIds = new Set(session.views.map(v => v.id))

  // An assignment is what marks a view as homed, so a stale one is worse than
  // none: pointing at a panel dockview no longer has leaves the view rendered
  // by nothing while the homing loop below still considers it placed.
  for (const panelId of [...session.panelViewAssignments.keys()]) {
    const panelGone = !api.getPanel(panelId)
    for (const viewId of session.getViewIdsForPanel(panelId)) {
      if (panelGone || !currentViewIds.has(viewId)) {
        session.removeViewFromPanel(viewId)
      }
    }
  }

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
}

/**
 * Adopt a restored session's saved within-panel order into `session.views`.
 *
 * A session saved before views had one ordering carries that order in
 * `panelViewAssignments` and nowhere else — the old `moveViewInPanel` wrote it
 * there and only there. That array is membership-only now and no longer read as
 * an order, so without this a workspace the user arranged comes back in whatever
 * order `session.views` happened to be in, silently undoing the arrangement.
 *
 * Per panel, never flattened across panels: `orderViews` only permutes the slots
 * the named views already occupy, so one panel's saved order is applied without
 * disturbing where any other panel's views sit. Idempotent for anything saved
 * since — reconcile assigns in `session.views` order, so the two already agree —
 * which is what makes it safe to run on every restore rather than gate on a
 * version.
 */
export function adoptSavedPanelOrder(
  session: DockviewSessionType & SessionWithDockviewLayout,
) {
  for (const panelId of [...session.panelViewAssignments.keys()]) {
    session.orderViews(session.getViewIdsForPanel(panelId))
  }
}

// No `title`: an unset title makes JBrowseViewTab derive the tab name from the
// panel's views (see getTabDisplayName). A title is only ever set when the user
// explicitly renames a tab via api.setTitle.
//
// No `params` either: panel identity is `api.id`, and the live MST session
// reaches the portaled panel/tab components through DockviewContext. Anything
// put here would have to survive api.toJSON(), so a session reference would
// serialize a circular snapshot into the persisted layout.
export function createPanelConfig(panelId: string) {
  return {
    id: panelId,
    component: 'jbrowseView' as const,
    tabComponent: 'jbrowseTab' as const,
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

// Every viewId the layout names, in the order it reads: depth-first over
// children, then each panel's own list.
function flattenLayoutViewIds(node: DockviewLayoutNode): string[] {
  return [
    ...(node.viewIds ?? []),
    ...(node.children ?? []).flatMap(child => flattenLayoutViewIds(child)),
  ]
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
      // no direction is how dockview says "same group, another tab": the panel
      // is positioned against the reference group without splitting it
      const dockviewDirection =
        node.direction === 'tabs'
          ? undefined
          : node.direction === 'horizontal'
            ? 'right'
            : 'below'
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

  // The layout states an order too: its panels read left to right / top to
  // bottom, and each panel lists its views top to bottom. That used to land in
  // the assignment arrays, which are membership-only now, so it lands in
  // `session.views` instead, which is the one ordering. A layout that agrees
  // with the views array (the usual case) is a no-op here.
  session.orderViews(flattenLayoutViewIds(initLayout))

  // 'tabs' children share one group's space, so there is nothing to distribute
  const splitDirection =
    initLayout.direction === 'tabs' ? undefined : initLayout.direction
  if (
    groupSizes.length >= 2 &&
    splitDirection &&
    groupSizes.length === initLayout.children?.length
  ) {
    const dimension = splitDirection === 'horizontal' ? 'width' : 'height'
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

  // carries `title` forward so a user-renamed tab survives a re-tile
  const panelStates = panels.map(p => ({
    ...createPanelConfig(p.id),
    title: p.title,
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
