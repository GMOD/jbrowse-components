// A runtime plugin in the shape a code-split build emits: an ENTRY that
// registers, and a second module holding the weight. The host evaluates the
// entry when a config names the plugin; the second module loads when the view
// is first opened.
//
// Hand-written rather than bundled. A real plugin gets these two files out of
// one `src/index.ts` through esbuild `splitting: true`, and the split holds
// only while nothing in the entry's own graph names the deferred side — which
// is the part that breaks silently, and what the test beside this fixture
// pins. See website/docs/developer_guides/plugin_load_cost.md.
import Plugin from '@jbrowse/core/Plugin'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default class SplitPlugin extends Plugin {
  name = 'SplitPlugin'
  version = '1.0'

  install(pluginManager) {
    // #region register
    pluginManager.addViewType(() => {
      return new ViewType({
        name: 'SplitView',
        // A thunk, so this module's graph does not name ./viewModel.js and the
        // bundler is free to put it in another chunk. Passing
        // `stateModelFactory()` here instead would register the same view and
        // cost the whole chunk at install.
        stateModel: () => import('./viewModel.js').then(f => f.default()),
        ReactComponent: () => null,
      })
    })
    // #endregion
  }
}
