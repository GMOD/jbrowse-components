---
title: Custom widgets
description: Add new drawer/panel UI components
guide_category: Plugins
---

**TL;DR:** Widgets are info panels shown in drawers, modals, or elsewhere in the
app (the config editor, feature detail popups, the add-track form). A widget
pairs a state model with a React component, registered via
`pluginManager.addWidgetType`.

Register a widget in `index.tsx`:

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

- [](/docs/developer_guides/drawer_widgets)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/configuration_schema)
- [](/docs/developer_guides/pluggable_elements)
