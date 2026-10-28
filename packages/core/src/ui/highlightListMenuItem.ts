import type { MenuItem } from './MenuTypes.ts'

// Structural rather than the session and PluginManager types: those reach the
// session graph, which `menuItems.ts` must not (scripts/moduleClosure.test.ts)
interface WidgetHost {
  openWidget?: (typeName: string, id: string) => unknown
}
interface WidgetRegistry {
  widgetTypes: { has: (typeName: string) => boolean }
}

/** #menuBuilder highlightListMenuItems | "Open highlight list", or nothing in a product without the widget */
export function highlightListMenuItems(
  session: WidgetHost,
  pluginManager: WidgetRegistry,
): MenuItem[] {
  const { openWidget } = session
  return openWidget && pluginManager.widgetTypes.has('GridBookmarkWidget')
    ? [
        {
          label: 'Open highlight list',
          onClick: () => {
            openWidget('GridBookmarkWidget', 'GridBookmark')
          },
        },
      ]
    : []
}
