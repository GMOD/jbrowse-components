import { getEnv } from '@jbrowse/core/util'
import { preloadComponent } from '@jbrowse/core/util/preloadComponent'

import { DrawerWidget, WorkspaceContainer } from './lazyParts.ts'

import type { AppSession } from './types.ts'

/**
 * Load the views container and the drawer while the session's own view code
 * downloads, settling when both have. An app that renders after this renders
 * its frame in one pass; otherwise the first render suspends on them and React
 * holds the retry for 300 ms.
 */
export async function preloadAppFrame() {
  await Promise.allSettled([
    WorkspaceContainer.preload(),
    DrawerWidget.preload(),
  ])
}

/**
 * Request the app frame's lazy parts that `session` will show (its views
 * container, the drawer and the widget open in it) as soon as the session
 * exists. Rendering asks for each only when it reaches it, a round trip apiece.
 */
export function preloadAppShell(session: AppSession) {
  if (session.views.length > 0) {
    preloadComponent(WorkspaceContainer)
  }
  const { drawerVisible, visibleWidget } = session
  if (drawerVisible) {
    preloadComponent(DrawerWidget)
  }
  if (drawerVisible && visibleWidget) {
    const { pluginManager } = getEnv(session)
    try {
      preloadComponent(
        pluginManager.getWidgetType(visibleWidget.type).ReactComponent,
      )
    } catch {
      // an unknown widget type is reported when the drawer renders it
    }
  }
}
