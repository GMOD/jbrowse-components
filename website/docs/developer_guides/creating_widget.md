---
title: Custom widgets
description: Add new drawer/panel UI components
guide_category: Plugins
---

**TL;DR:** Widgets are info panels shown in drawers, modals, or elsewhere in the
app (the config editor, feature detail popups, the add-track form). A widget
pairs a state model with a React component, registered via
`pluginManager.addWidgetType`.

Register a widget in `index.ts`. `HelpWidget` is a whole one — the config
schema, the state model and the registration, in the file that exports the
plugin-install function:

<!-- include: plugins/menus/src/HelpWidget/index.ts -->

```ts
import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { WidgetType } from '@jbrowse/core/pluggableElementTypes'
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
      heading: 'Help',
      configSchema,
      stateModel,
      ReactComponent: lazy(() => import('./components/HelpWidget.tsx')),
    })
  })
}
```

`id` and `type` are what every widget state model carries. `ElementId` is
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

A widget that displays something declares its own fields on the state model
alongside `id` and `type`, and receives them as `addWidget`'s third argument —
`UcscResultsWidget` in the BLAT plugin is that shape, holding the hits its table
renders.

## Opening a widget

A widget is opened by the `name` its `WidgetType` was registered under. BLAT
opens its results table that way when a search returns hits:

<!-- include: plugins/blat/src/ucscShared.ts#showWidget -->

```ts
// addWidget constructs the widget and returns it; showWidget is what puts it
// in the drawer. The third argument is the initial state, so its keys are the
// properties UcscResultsWidget's state model declares. Not every session has
// a drawer — an embedded component may be built without one — so the guard is
// not optional.
if (isSessionModelWithWidgets(session)) {
  session.showWidget(
    session.addWidget('UcscResultsWidget', 'ucscResults', {
      features,
      assembly,
      trackName,
      resultNoun,
    }),
  )
}
```

**That second argument is the widget's identity, not a label.**
`session.widgets` is a map keyed by it, so `addWidget` with an id already in the
map replaces what was there. BLAT's fixed `'ucscResults'` therefore means every
search reuses one results widget; pass a fresh id (`createElementId()`, from the
same module as `ElementId`) where you want instances to coexist.

See [](/docs/developer_guides/drawer_widgets) for the rest of the drawer:
position, width, minimizing, and closing a widget again.

## See also

- [](/docs/developer_guides/drawer_widgets)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/pluggable_elements)
