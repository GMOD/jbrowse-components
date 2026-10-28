import type { MenuItem } from './MenuTypes.ts'

// Structural rather than the session and PluginManager types: those reach the
// session graph, which `menuItems.ts` must not (scripts/moduleClosure.test.ts)
interface WidgetHost {
  openWidget: (typeName: string, id: string) => unknown
}
interface WidgetRegistry {
  widgetTypes: { has: (typeName: string) => boolean }
}

function isWidgetHost(session: object): session is WidgetHost {
  return 'widgets' in session && 'openWidget' in session
}

/** #menuBuilder highlightListMenuItems | "Open highlight list", or nothing in a product without the widget */
export function highlightListMenuItems(
  session: object,
  pluginManager: WidgetRegistry,
): MenuItem[] {
  return isWidgetHost(session) &&
    pluginManager.widgetTypes.has('GridBookmarkWidget')
    ? [
        {
          label: 'Open highlight list',
          onClick: () => {
            session.openWidget('GridBookmarkWidget', 'GridBookmark')
          },
        },
      ]
    : []
}
