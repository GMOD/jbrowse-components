import { getParent, hasParent, isAlive, types } from '@jbrowse/mobx-state-tree'

import { getConf } from '../../configuration/index.ts'
import {
  getContainingTrack,
  getEnv,
  statusFraction,
  statusMessageText,
} from '../../util/index.ts'
import { ElementId } from '../../util/types/mst.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { MenuItem } from '../../ui/index.ts'
import type { RpcStatus } from '../../util/progress.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * #stateModel BaseDisplay
 * #category display
 */
function stateModelFactory() {
  return types
    .model('BaseDisplay', {
      /**
       * #property
       */
      id: ElementId,
      /**
       * #property
       */
      type: types.string,
      /**
       * #property
       */
      rpcDriverName: types.maybe(types.string),
    })
    .volatile(() => ({
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      error: undefined as unknown,
      statusMessage: undefined as string | undefined,
      /**
       * #volatile
       * determinate progress fraction [0,1] for the current status, or
       * undefined when the in-flight phase is indeterminate. Set alongside
       * `statusMessage` by `setStatusMessage`; a display that never shows a
       * bar simply leaves it undefined.
       */
      statusProgress: undefined as number | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       */
      get parentTrack() {
        if (!hasParent(self)) {
          console.warn(
            `[BaseDisplayModel] parentTrack accessed with no parent: alive=${isAlive(self)} type=${self.type}`,
          )
        }
        return getContainingTrack(self)
      },

      /**
       * #getter
       * Returns the parent display if this display is nested within another display
       * (e.g., PileupDisplay inside LinearAlignmentsDisplay)
       */
      get parentDisplay() {
        if (hasParent(self)) {
          const parent = getParent<{
            type?: string
            effectiveRpcDriverName?: string
          }>(self)
          if (
            typeof parent.type === 'string' &&
            parent.type.endsWith('Display')
          ) {
            return parent
          }
        }
        return undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get RenderingComponent(): React.FC<{
        model: typeof self
        onHorizontalScroll?: (distance: number) => void
        blockState?: Record<string, unknown>
      }> {
        const { pluginManager } = getEnv(self)
        return pluginManager.getDisplayType(self.type)
          .ReactComponent as React.FC<{
          model: typeof self
          onHorizontalScroll?: (distance: number) => void
          blockState?: Record<string, unknown>
        }>
      },

      /**
       * #getter
       */
      get DisplayBlurb(): React.FC<{ model: typeof self }> | null {
        return null
      },

      /**
       * #getter
       */
      get adapterConfig(): Record<string, unknown> {
        // `Record<string, unknown>` is as narrow as this can honestly get: which
        // adapter a track uses is open-ended, so the *contents* are
        // unpredictable. The *shape* is not, and that is the part worth
        // declaring. Leaving it to infer `getConf`'s `any` was the status quo and
        // it propagated: every consumer's RPC arg and adapter spec takes
        // `Record<string, unknown>`, so they accepted whatever they were handed,
        // and two displays re-declared this getter locally just to annotate it.
        //
        // Not `| undefined` — see `BaseTrackModel.adapterConfig` for the probe
        // showing the slot always materializes an object.
        //
        // This is a snapshot, so read a specific slot with an array path off the
        // live node (`getConf(track, ['adapter', 'x'])`) rather than off this —
        // `types.stripDefault` omits a slot at its default. See
        // ../../configuration/CLAUDE.md.
        return getConf(self.parentTrack, 'adapter')
      },

      /**
       * #getter
       * Returns true if the parent track is minimized. Used to skip
       * expensive operations like autoruns when track is not visible.
       */
      get isMinimized() {
        return self.parentTrack.minimized
      },

      /**
       * #getter
       * Overridable hook (default `undefined`): what the pointer is currently
       * over, for readers **outside** the display. `LinearGenomeViewContainer`
       * publishes it to `session.hovered`, the view-wide "what is the user
       * pointing at" channel a plugin can subscribe to.
       *
       * Declared here because a cross-display consumer can only read a name the
       * base declares — the same reason `SyntenyFetchStateMixin.fetchInert` is a
       * hook rather than a getter each display invents. The container used to
       * read `featureUnderMouse`, which only the wiggle, alignments and
       * Manhattan families spelled that way — canvas said `hoveredFeature`,
       * variants `hoveredGenotype` — so the channel carried a hover from a third
       * of the display types and nothing said which. It also asked only
       * `displays[0]` of each track.
       *
       * `unknown` because the payload genuinely differs — a read, a wiggle bin,
       * a SNP, a genotype cell — and `session.hovered` is typed to match ("can
       * be anything; code that wants to deal with this should examine it").
       * Narrow it in the override.
       */
      get hoveredFeature(): unknown {
        return undefined
      },

      /**
       * #getter
       * Returns the effective RPC driver name with hierarchical fallback:
       * 1. This display's explicit rpcDriverName
       * 2. Parent display's effectiveRpcDriverName (for nested displays)
       * 3. Track config's rpcDriverName
       */
      get effectiveRpcDriverName() {
        if (self.rpcDriverName) {
          return self.rpcDriverName
        }
        if (self.parentDisplay?.effectiveRpcDriverName) {
          return self.parentDisplay.effectiveRpcDriverName
        }
        return getConf(self.parentTrack, 'rpcDriverName')
      },
    }))
    .views(self => ({
      /**
       * #method
       * props passed to the renderer's React "Rendering" component.
       * these are client-side only and never sent to the worker.
       * includes displayModel and callbacks
       */
      renderingProps() {
        return {
          displayModel: self,
        }
      },

      /**
       * #method
       */
      trackMenuItems(): MenuItem[] {
        return []
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setStatusMessage(status?: RpcStatus) {
        // derive the indeterminate label and the determinate fraction from the
        // one status transport; displays with no bar just ignore statusProgress
        self.statusMessage = statusMessageText(status)
        self.statusProgress = statusFraction(status)
      },
      /**
       * #action
       */
      setError(error?: unknown) {
        self.error = error
      },
      /**
       * #action
       */
      setRpcDriverName(rpcDriverName: string) {
        self.rpcDriverName = rpcDriverName
      },
      /**
       * #action
       * base display reload does nothing, see specialized displays for details
       */
      reload() {},
    }))
}

export const BaseDisplay = stateModelFactory()
export type BaseDisplayStateModel = typeof BaseDisplay
export type BaseDisplayModel = Instance<BaseDisplayStateModel>

/**
 * The shape every display instance held in a track's `displays` array
 * satisfies: the composed `BaseDisplay` state model (RenderingComponent,
 * DisplayBlurb, trackMenuItems, ...) plus the `configuration`
 * reference every display gains at instantiation. `getPortableSettings` is
 * optional — only display types that support switching type via the track menu
 * implement it. This is the concrete element type behind
 * `BaseTrackModel.displays`, which the runtime plugin union erases to `any`.
 */
export interface DisplayModel extends BaseDisplayModel {
  configuration: AnyConfigurationModel & { displayId: string }
  getPortableSettings?: (
    newDisplayId?: string,
  ) => Record<string, unknown> | undefined
}
