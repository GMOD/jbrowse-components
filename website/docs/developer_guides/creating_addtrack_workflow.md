---
title: Add-track workflows
description: Custom UI in the Add track dialog for non-standard track types
guide_category: Plugins
---

**TL;DR:** Register a React component in the "Add track" widget for tracks that
need custom logic. The Multi-wiggle track does this, producing a textbox to
paste a list of files.

The multi-wiggle workflow is the whole registration:

<!-- include: plugins/wiggle/src/MultiWiggleAddTrackWorkflow/index.ts -->

```ts
import { lazy } from 'react'

import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function MultiWiggleAddTrackWorkflowF(pm: PluginManager) {
  pm.addAddTrackWorkflowType(
    () =>
      new AddTrackWorkflowType({
        name: 'Multi-wiggle track',
        displayName: 'Add multi-wiggle track',
        ReactComponent: lazy(() => import('./AddTrackWorkflow.tsx')),
        stateModel: types.model({}),
      }),
  )
}
```

`ReactComponent` is the form rendered inside the "Add track" widget, and it is
lazily imported so the form's code only loads when a user picks this workflow.
`stateModel` is the workflow's own state; an empty `types.model({})` is fine
when the form holds everything it needs in React state.

Call `MultiWiggleAddTrackWorkflowF(pm)` from your plugin's `install()`, the same
as any other pluggable element.

## See also

- [](/docs/developer_guides/creating_connection)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/pluggable_elements)
