// Compile-time check that the hand-rolled LinearBasicDisplayModel structural
// type in components/FeatureComponent.tsx stays in sync with the real MST
// model. Renaming or removing a field on the model is a type error here
// instead of a silent runtime failure inside the lazy-loaded component.
//
// Imports are type-only so the file is erased at runtime — that's what keeps
// the lazy()-induced cycle between model.ts and FeatureComponent.tsx from
// breaking inference (see FeatureComponent.tsx for context).

import type { LinearBasicDisplayModel } from './components/FeatureComponent.tsx'
import type stateModelFactory from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

type _AssignableTo<T extends LinearBasicDisplayModel> = T

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelImplementsContract = _AssignableTo<
  Instance<ReturnType<typeof stateModelFactory>>
>
