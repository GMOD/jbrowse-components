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

- **`ReactComponent`** is the form rendered inside the "Add track" widget,
  lazily imported so the form's code only loads when a user picks this workflow
- **`stateModel`** is the workflow's own state; an empty `types.model({})` is
  fine when the form holds everything it needs in React state
- **`category`** groups the workflow in the dropdown under "General" or
  "Specialized track types". An omitted `category` means `'specialized'`, which
  fits a workflow targeting one data type, as the multi-wiggle one does; pass
  `category: 'general'` for a workflow that accepts any track

The component is rendered with two props. `model` is the add-track widget's
model, and **`switchWorkflow(name)`** moves the user to another workflow by name
— what the built-in file/URL form uses to hand off to the bulk one. A component
typed for `model` alone still compiles, since the extra prop is assignable, so
nothing points this out at the call site.

Call `MultiWiggleAddTrackWorkflowF(pm)` from your plugin's `install()`, the same
as any other pluggable element.

## See also

- [](/docs/developer_guides/creating_connection)
- [](/docs/developer_guides/extension_points)
- [](/docs/developer_guides/pluggable_elements)
