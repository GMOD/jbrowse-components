---
title: Custom widgets
description: Add new drawer/panel UI components
guide_category: Creating pluggable elements
---

Widgets are info panels that appear in side panels (drawers), modals, or other
places in the app — for example the configuration editor, feature detail popups,
and the add-track form. A custom widget pairs a state model with a React
component and is registered with `pluginManager.addWidgetType`.

Register a custom widget in `index.tsx`:

```tsx
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'
import { observer } from 'mobx-react'

const ReactComponent = observer(function ({
  model,
}: {
  model: { mydata: unknown }
}) {
  return <div>Message: {`${model.mydata}`}</div>
})

const configSchema = ConfigurationSchema('MyWidget', {})

const stateModel = types
  .model('MyWidget', {
    id: ElementId,
    type: types.literal('MyWidget'),
    mydata: types.frozen(),
  })
  .actions(self => ({
    setMyData(data: unknown) {
      self.mydata = data
    },
    clearMyData() {
      self.mydata = undefined
    },
  }))

export default (pluginManager: PluginManager) => {
  pluginManager.addWidgetType(
    () =>
      new WidgetType({
        name: 'MyWidget',
        heading: 'My custom widget',
        configSchema,
        stateModel,
        ReactComponent,
      }),
  )
}
```

Use it:

```typescript
const widget = session.addWidget('MyWidget', 'instanceOfMyWidget', {
  mydata: 'Hello from my widget',
})
session.showWidget(widget)
```

## See also

- [Drawer widgets in embedded components](/docs/developer_guides/drawer_widgets)
  — show a widget as a resizable side panel
- [Extension points](/docs/developer_guides/extension_points) —
  `Core-replaceWidget` and `Core-extraFeaturePanel` customize existing widgets
- [Configuration schema](/docs/developer_guides/configuration_schema) — define
  the widget's `configSchema`
- [Pluggable elements](/docs/developer_guides/pluggable_elements)
