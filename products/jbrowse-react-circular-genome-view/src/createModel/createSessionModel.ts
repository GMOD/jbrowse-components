import { EmbeddedSessionMixin } from '@jbrowse/embedded-core'
import { cast, types } from '@jbrowse/mobx-state-tree'
import { TracksManagerSessionMixin } from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  SessionWithConfigEditing,
  SessionWithConnections,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { EmbeddedSessionParent } from '@jbrowse/embedded-core'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { CircularViewStateModel } from '@jbrowse/plugin-circular-view'
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
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactCircularGenomeViewSession',
      EmbeddedSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      view: pluginManager.getViewType('CircularView')!
        .stateModel as CircularViewStateModel,
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
      addView(typeName: string, initialState = {}) {
        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

      /**
       * #action
       * does nothing
       */
      removeView() {},
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
