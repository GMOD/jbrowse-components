import type { DockviewSessionType } from './types.ts'
import type { DockviewApi } from 'dockview-react'

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

export function cleanLayoutForStorage(
  layout: ReturnType<DockviewApi['toJSON']>,
) {
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
