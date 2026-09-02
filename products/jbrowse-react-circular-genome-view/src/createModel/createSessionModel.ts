import { EmbeddedSessionMixin } from '@jbrowse/embedded-core'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { SessionTracksManagerSessionMixin } from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewSnapshotInput } from '@jbrowse/core/PluginManager'
import type {
  SessionWithConfigEditing,
  SessionWithConnections,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { EmbeddedSessionParent } from '@jbrowse/embedded-core'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

// Compile-time guard binding the shared parent shadow to this product's real
// root. getParent<T> is an unchecked assertion, so this catches
// EmbeddedSessionParent drifting from the root model (e.g. a renamed/removed
// prop) at build time, not runtime.
export type _SessionModelParentCheck = AssertExtends<
  ViewModel,
  EmbeddedSessionParent
>

/**
 * #stateModel JBrowseReactCircularGenomeViewSessionModel
 *
 * The shared {@link EmbeddedSessionMixin} plus this product's tracks mixin and
 * its single CircularView. Both are spelled out here rather than passed to a
 * shared factory because `types.compose` cannot infer through a generic — see
 * EmbeddedSessionMixin.
 *
 * The tracks mixin is the session-tracks one, the same the linear embed uses.
 * The plainer `TracksManagerSessionMixin` sends `addTrackConf` on to
 * `jbrowse.addTrackConf`, which the embedded root config model does not have —
 * so a host adding a track after mount got a TypeError, and there was no other
 * door: this product's whole track set had to be decided at build time.
 */
// the CircularView state model is a lazy loader embedded here as the `view`
// prop, so createViewState awaits its loadStateModel() before calling this
export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactCircularGenomeViewSession',
      EmbeddedSessionMixin(pluginManager),
      SessionTracksManagerSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      view: pluginManager.getViewType('CircularView').stateModel,
    })
    .views(self => ({
      /**
       * #getter
       */
      get views() {
        return [self.view]
      },
    }))
    .actions(self => ({
      /**
       * #action
       * replaces view in this case
       */
      addView<N extends string>(
        typeName: N,
        initialState?: NoInfer<ViewSnapshotInput<N>>,
      ) {
        // `N` is still generic in here, so the spread cannot line up with the
        // one concrete view type this session holds -- the parameter above is
        // what checks the snapshot, at the call site
        self.view = cast({
          ...initialState,
          type: typeName,
        } as SnapshotIn<typeof self.view>)
        return self.view
      },

      /**
       * #action
       * does nothing
       */
      removeView() {},
    }))
    .actions(self => ({
      /**
       * #action
       * addView, async to satisfy the AbstractViewContainer contract
       */
      async launchView(typeName: string, initialState = {}) {
        return self.addView(typeName, initialState)
      },
    }))
}

type SessionStateModel = ReturnType<typeof sessionModelFactory>

// the capability contracts this embedded view relies on — see
// AssertSessionModel for why each one is asserted separately
export type _AssertSessionModel = AssertSessionModel<
  Instance<SessionStateModel>
>
export type _AssertDrawerWidgets = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithDrawerWidgets
>
export type _AssertConnections = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithConnections
>
export type _AssertConfigEditing = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithConfigEditing
>
