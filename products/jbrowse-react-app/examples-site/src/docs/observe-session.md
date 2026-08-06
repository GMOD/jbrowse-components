The session is a [MobX-state-tree](https://mobx-state-tree.js.org/) node, so a
component outside the app can wrap in `mobx-react`'s `observer` and read it
directly. Anything marked `#getter` or `#property` on the
[session model](https://jbrowse.org/jb2/docs/models/basesessionmodel/) or a
[view model](https://jbrowse.org/jb2/docs/models/lineargenomeview/) is reactive:
which views are open, what each has, where each is looking. There is no
subscription to set up and nothing to unsubscribe.

That is also why there is no patch callback. `createViewState` used to take an
`onChange(patch, reversePatch)` that fired on every MST patch, and it was the
wrong shape for both things people reached for it with: to keep UI in sync you
want `observer`, which re-renders exactly the readers of what changed, and to
persist a session you want a snapshot rather than a stream of edits to one.

Saving the layout is the snapshot:

```js
import { getSnapshot } from '@jbrowse/mobx-state-tree'

localStorage.setItem(
  'jbrowse-session',
  JSON.stringify(getSnapshot(viewState.session)),
)
```

and restoring it is the `session` option (or `controller.setSession`). A host
outside React — a notebook kernel, an R session — cannot run an `observer`, and
takes `onSessionChange` instead: same snapshot, delivered on a settled signal
rather than per keystroke. See
[embedded components](https://jbrowse.org/jb2/docs/embedded_components/).
