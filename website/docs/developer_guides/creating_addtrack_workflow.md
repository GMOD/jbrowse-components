---
title: Add-track workflows
description: Custom UI in the Add track dialog for non-standard track types
guide_category: Plugins
---

**TL;DR:** Register a React component in the "Add track" widget for tracks that
need custom logic. The Multi-wiggle track does this, producing a textbox to
paste a list of files.

A simple add-track workflow:

```ts
// plugins/wiggle/src/MultiWiggleAddTrackWorkflow/index.ts

import PluginManager from '@jbrowse/core/PluginManager'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import MultiWiggleWidget from './AddTrackWorkflow'

export default (pm: PluginManager) => {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        // ReactComponent (in a separate file) is the form rendered in the track widget
        ReactComponent: MultiWiggleWidget,
        stateModel: types.model({}),
      }),
  )
}
```

Install this component into your plugin:

```ts
// plugins/wiggle/src/index.ts

import MultiWiggleAddTrackWorkflowF from './MultiWiggleAddTrackWorkflow'

// ...

export default class WigglePlugin extends Plugin {
  name = 'WigglePlugin'

  install(pm: PluginManager) {
    // ...
    MultiWiggleAddTrackWorkflowF(pm)
    // ...
  }
}
```

## See also

- [Creating custom connections](/docs/developer_guides/creating_connection)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/pluggable_elements)
