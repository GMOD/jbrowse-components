import { EmbeddedSessionMixin } from '@jbrowse/embedded-core'
import { cast, getParent, types } from '@jbrowse/mobx-state-tree'
import { SessionTracksManagerSessionMixin } from '@jbrowse/product-core'

import type { ViewModel } from './createModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  SessionWithAddSessionTrack,
  SessionWithPublishTrackConf,
  SessionWithConfigEditing,
  SessionWithConnections,
  SessionWithDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { EmbeddedSessionParent } from '@jbrowse/embedded-core'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewStateModel } from '@jbrowse/plugin-linear-genome-view'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

// This product's root carries one prop beyond the shared shadow, so the slice
// this session reaches for is that shadow plus the one field.
interface SessionModelParent extends EmbeddedSessionParent {
  disableAddTracks: boolean
  effectiveHeight: string | undefined
}

// Compile-time guard binding the shadow to the real root. getParent<T> is an
// unchecked assertion, so this catches SessionModelParent drifting from the root
// model (e.g. a renamed/removed prop) at build time, not runtime.
export type _SessionModelParentCheck = AssertExtends<
  ViewModel,
  SessionModelParent
>

/**
 * #stateModel JBrowseReactLinearGenomeViewSessionModel
 *
 * The shared {@link EmbeddedSessionMixin} plus this product's tracks mixin, its
 * single LinearGenomeView, and `disableAddTracks`, which is a root prop rather
 * than a session one. The mixin and the view are spelled out here rather than
 * passed to a shared factory because `types.compose` cannot infer through a
 * generic — see EmbeddedSessionMixin.
 */
export default function sessionModelFactory(pluginManager: PluginManager) {
  return types
    .compose(
      'ReactLinearGenomeViewSession',
      EmbeddedSessionMixin(pluginManager),
      SessionTracksManagerSessionMixin(pluginManager),
    )
    .props({
      /**
       * #property
       */
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      view: pluginManager.getViewType('LinearGenomeView')!
        .stateModel as LinearGenomeViewStateModel,
    })
    .views(self => ({
      /**
       * #getter
       */
      get disableAddTracks() {
        return getParent<SessionModelParent>(self).disableAddTracks
      },
      /**
       * #getter
       */
      get views() {
        return [self.view]
      },
      /**
       * #getter
       * Pin the header, and scroll the tracks under it, whenever the view is
       * bounded -- which is the only time it means anything, since an unbounded
       * view scrolls with the host's page and has nothing of its own to pin
       * against. The LGV model reads this off the session
       * (`stickyViewHeaders === true`) and so does the embedded view title
       * above it, the same two readers the web app has.
       */
      get stickyViewHeaders() {
        return Boolean(getParent<SessionModelParent>(self).effectiveHeight)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addView(typeName: string, initialState = {}) {
        self.view = cast({
          ...initialState,
          type: typeName,
        })
        return self.view
      },

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
export type _AssertAddSessionTrack = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithAddSessionTrack
>
export type _AssertPublishTrackConf = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithPublishTrackConf
>
export type _AssertConfigEditing = AssertExtends<
  Instance<SessionStateModel>,
  SessionWithConfigEditing
>
