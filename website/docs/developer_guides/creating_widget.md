---
id: creating_widget
title: Creating a custom widget
---

Here is an example of registering a custom widget

index.tsx

```tsx
import React from 'react'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import WidgetType from '@jbrowse/core/pluggableElementTypes/WidgetType'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from 'mobx-state-tree'

// model is an instance of the stateModel below
function ReactComponent({ model }: { model: any }) {
  return <div>Message: {`${model.mydata}`}</div>
}

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

This can then be used in code by saying

```typescript
const widget = session.addWidget('MyWidget', 'instanceOfMyWidget', {
  mydata: 'Hello from my widget',
})
session.showWidget(widget)
```
