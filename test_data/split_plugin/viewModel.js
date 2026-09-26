// The deferred half. In a real plugin this is where the rendering library
// lands — react-msaview, a structure viewer, a WASM module — and the point of
// the split is that a session which never opens the view never evaluates it.
import { ElementId } from '@jbrowse/core/util/types/mst'
import { types } from '@jbrowse/mobx-state-tree'

// The fixture's instrument, and not something a real plugin writes: the test
// asserts this is still 0 after the plugin has installed and been configured,
// and 1 once the view is launched. Counting evaluations rather than setting a
// flag is what catches the module being loaded twice.
globalThis.__splitPluginModuleEvaluations =
  (globalThis.__splitPluginModuleEvaluations ?? 0) + 1

export default function stateModelFactory() {
  return types.model('SplitView', {
    id: ElementId,
    type: types.literal('SplitView'),
    displayName: types.maybe(types.string),
  })
}
