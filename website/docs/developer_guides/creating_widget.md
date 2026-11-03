---
title: Custom widgets
description: Add new drawer/panel UI components
guide_category: Plugins
---

Widgets are info panels shown in drawers, modals, or elsewhere in the app (the
config editor, feature detail popups, the add-track form). A widget pairs a
state model with a React component, registered via
`pluginManager.addWidgetType`.

Register a widget in `index.ts`. `HelpWidget` is a whole one — the config
schema, the state model and the registration, in the file that exports the
plugin-install function:

<!-- include: packages/app-core/src/AppWidgets/HelpWidget/index.ts -->

```ts
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
import { lazyWithPreload } from '@jbrowse/core/util/lazyWithPreload'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

const configSchema = ConfigurationSchema('HelpWidget', {})

const stateModel = types.model('HelpWidget', {
  id: ElementId,
  type: types.literal('HelpWidget'),
})

export default function HelpWidgetF(pluginManager: PluginManager) {
  pluginManager.addWidgetType(() => {
    return new WidgetType({
      name: 'HelpWidget',
      discardOnClose: true,
      heading: 'Help',
      configSchema,
      stateModel,
      ReactComponent: lazyWithPreload(
        () => import('./components/HelpWidget.tsx'),
      ),
    })
  })
}
```

Every widget state model has `id` and `type`. `ElementId` is
`types.optional(types.identifier, …)`, generating a nanoid on the restore path
when a snapshot arrives without one; `addWidget` always passes the id
explicitly. The `types.literal` tells MST which model to rehydrate a saved
session into. `ReactComponent` is `lazy`-loaded, so a widget's UI code is only
fetched the first time it opens.

`heading` is the static drawer title. Two more `WidgetType` options replace or
extend it:

- **`HeadingComponent`** takes over the title entirely, receiving the widget
  model as `model` — the configuration editor uses one, to name the track being
  edited.
- **`helpText`** puts a help button beside the title that opens what you pass in
  a dialog.

A widget that displays something declares fields on the state model alongside
`id` and `type`, and receives them as `addWidget`'s third argument —
`UcscResultsWidget` in the BLAT plugin is that shape, holding the hits its table
renders.

Closing a widget hides it, and it stays in the session with everything it holds.
A widget that shows a result rather than a tool a user returns to — a feature's
details, a search's hits — sets **`discardOnClose: true`** on its `WidgetType`,
so closing removes it and what it holds stops riding along in every session a
user saves or shares.

## Opening a widget

A caller opens a widget by the `name` its `WidgetType` was registered under.
Clicking a feature opens its details panel that way. The guard is not optional:
not every session has a drawer, and an embedded component may be built without
one.

<!-- include: packages/core/src/util/openFeatureWidget.ts#openWidget -->

```ts
const session = getSession(node)
if (!isSessionModelWithWidgets(session)) {
  return undefined
}
session.setSelection(opts.feature ?? new SimpleFeature(featureData))
const { type, id } = opts.widget ?? DEFAULT_FEATURE_WIDGET
const widget = session.openWidget(type, id, {
  featureData,
  parentFeature: opts.parentFeature,
  view: getContainingView(node),
  track: getContainingTrack(node),
  ...opts.extra,
})
return widget
```

**That second argument is the widget's identity, not a label.**
`session.widgets` is a map keyed by it, so `addWidget` with an id already in the
map replaces what was there. The feature-details panel reuses one id, so a click
on a second feature replaces the first one's panel; a widget that shows one
search's results builds its id from that search, so each gets its own and the
drawer's widget picker switches between them. Reuse one id where a new instance
should replace the last; use `createElementId()`, from the same module as
`ElementId`, where nothing identifies an instance.

See [](/docs/developer_guides/drawer_widgets) for the rest of the drawer:
position, width, minimizing, and closing a widget again.

## See also

- [](/docs/developer_guides/drawer_widgets)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/pluggable_elements)
