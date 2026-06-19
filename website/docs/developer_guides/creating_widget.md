---
title: Creating custom widgets
description: Add new drawer/panel UI components
guide_category: Creating pluggable elements
---

Here is an example of registering a custom widget in `index.tsx`:

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

You can then use it in code:

```typescript
const widget = session.addWidget('MyWidget', 'instanceOfMyWidget', {
  mydata: 'Hello from my widget',
})
session.showWidget(widget)
```
