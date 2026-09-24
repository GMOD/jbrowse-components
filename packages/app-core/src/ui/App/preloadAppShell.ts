import { preloadComponent } from '@jbrowse/core/util/preloadComponent'
import { getEnv } from '@jbrowse/mobx-state-tree'

import { isSessionWithWorkspaceLayout } from '../../WorkspaceLayout/model.ts'
import {
  ClassicViewsContainer,
  DrawerWidget,
  WorkspaceContainer,
} from './lazyParts.ts'

import type { AppSession } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * Request the views container and the drawer before the session exists, while
 * the session's own view and display code downloads. Without it both land a
 * round trip after the session, and the app's first render suspends on them.
 */
export function preloadAppFrame() {
  preloadComponent(ClassicViewsContainer)
  preloadComponent(DrawerWidget)
}

/**
 * Request the app frame's lazy parts that `session` will show (its views
 * container, the drawer and the widget open in it) as soon as the session
 * exists. Rendering asks for each only when it reaches it, a round trip apiece.
 */
export function preloadAppShell(session: AppSession) {
  if (session.views.length > 0) {
    preloadComponent(
      session.effectiveUseWorkspaces && isSessionWithWorkspaceLayout(session)
        ? WorkspaceContainer
        : ClassicViewsContainer,
    )
  }
  const { drawerVisible, visibleWidget } = session
  if (drawerVisible) {
    preloadComponent(DrawerWidget)
  }
  if (drawerVisible && visibleWidget) {
    const { pluginManager } = getEnv<{ pluginManager: PluginManager }>(session)
    try {
      preloadComponent(
        pluginManager.getWidgetType(visibleWidget.type).ReactComponent,
      )
    } catch {
      // an unknown widget type is reported when the drawer renders it
    }
  }
}
