---
id: creating_addtrack_workflow
title: Creating custom add-track workflows
---

Plugins can register their own React component to display in the "Add track"
widget for adding tracks that require custom logic. The Multi-wiggle track is an
example of this, it produces a textbox where you can paste a list of files.

A simple addition to the add track workflow:

```js
// plugins/wiggle/MultiWiggleAddTrackWidget/index.jsx

import PluginManager from '@jbrowse/core/PluginManager'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from 'mobx-state-tree'

// locals
import MultiWiggleWidget from './AddTrackWorkflow'

export default (pm: PluginManager) => {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        /* in a separate file, export the react component to render within the track widget,
        typically a form to collect relevant data for your track */
        ReactComponent: MultiWiggleWidget,
        stateModel: types.model({}),
      }),
  )
}
```

...and ensure you install this component into your larger plugin:

```js
// plugins/wiggle/index.jsx

// ...

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    // ...
    MultiWiggleAddTrackWidgetF(pm)
    // ...
  }
}
```
