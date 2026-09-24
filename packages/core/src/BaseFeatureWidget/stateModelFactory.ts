import { getEnv, isStateTreeNode, types } from '@jbrowse/mobx-state-tree'

import { hydrateTrackConfig } from '../configuration/index.ts'
import { getSession } from '../util/index.ts'
import { ElementId } from '../util/types/mst.ts'
import { SequenceFeatureDetailsF } from './SequenceFeatureDetails/model.ts'
import { applyFormatDetails, formatDetailsNumber } from './formatDetails.ts'

import type PluginManager from '../PluginManager.ts'
import type { AnyConfigurationModel } from '../configuration/index.ts'
import type {
  ParentFeatureSummary,
  SimpleFeatureSerialized,
} from '../util/index.ts'
import type { SequenceHoverPosition } from './SequenceFeatureDetails/model.ts'
import type { FormatDetailsTiers } from './formatDetails.ts'
import type { Descriptors, MaybeSerializedFeat } from './types.tsx'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel BaseFeatureWidget
 * The feature-details panel. `featureData` is the clicked feature with the
 * track's and the session's `formatDetails` callbacks applied, derived on read
 * from the raw feature the widget was opened with, so the same widget follows a
 * config edit and survives its track being closed.
 */
export function stateModelFactory(pluginManager: PluginManager) {
  return types
    .model('BaseFeatureWidget', {
      /**
       * #property
       */
      id: ElementId,

      /**
       * #property
       */
      type: types.literal('BaseFeatureWidget'),

      /**
       * #property
       * the feature as the click handed it over, before any callback ran.
       * Persisted as `featureData`
       */
      unformattedFeatureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      ),

      /**
       * #property
       */
      view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      ),

      /**
       * #property
       */
      track: types.safeReference(
        pluginManager.pluggableMstType('track', 'stateModel'),
      ),

      /**
       * #property
       */
      trackId: types.maybe(types.string),

      /**
       * #property
       */
      trackType: types.maybe(types.string),

      /**
       * #property
       */
      sequenceFeatureDetails: types.optional(SequenceFeatureDetailsF(), {}),

      /**
       * #property
       */
      descriptions: types.optional(
        types.frozen<Descriptors | undefined>(),
        undefined,
      ),

      /**
       * #property
       * names the feature this one was reached through, when it was reached
       * through one -- a transcript clicked inside its gene
       */
      parentFeature: types.optional(
        types.frozen<ParentFeatureSummary | undefined>(),
        undefined,
      ),
    })
    .volatile<{
      sequenceHoverPosition: SequenceHoverPosition | undefined
    }>(() => ({
      /**
       * #volatile
       * genomic base currently hovered in this widget's sequence panel, read by
       * the LGV crosshair overlay
       */
      sequenceHoverPosition: undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * the config the track tier of `formatDetails` reads. The open track's
       * own while it is open; after it is closed, the session's copy of the
       * same config, which is why the widget records `trackId`
       */
      get trackConfiguration(): AnyConfigurationModel | undefined {
        const { track, trackId } = self
        if (track) {
          return track.configuration
        }
        if (!trackId) {
          return undefined
        }
        const conf = getSession(self).getTrackById(trackId)
        return conf === undefined || isStateTreeNode(conf)
          ? conf
          : hydrateTrackConfig(getEnv(self).pluginManager, conf)
      },
    }))
    .views(self => ({
      get formatDetailsTiers(): FormatDetailsTiers {
        return {
          session: getSession(self).configuration,
          track: self.trackConfiguration,
        }
      },
    }))
    .views(self => ({
      get formatted(): { feature?: SimpleFeatureSerialized; error?: Error } {
        const { unformattedFeatureData } = self
        if (!unformattedFeatureData) {
          return {}
        }
        try {
          return {
            feature: applyFormatDetails(
              self.formatDetailsTiers,
              unformattedFeatureData,
            ),
          }
        } catch (e) {
          const error = new Error(
            `Error running the formatDetails callbacks: ${e}`,
            { cause: e },
          )
          console.error(error)
          return { error }
        }
      },
      /**
       * #getter
       * levels of subfeature card the panel renders; unset means no limit
       */
      get maxDepth() {
        return formatDetailsNumber(self.formatDetailsTiers, 'maxDepth')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the feature with every `formatDetails` callback applied
       */
      get featureData() {
        return self.formatted.feature
      },
      /**
       * #getter
       */
      get error() {
        return self.formatted.error
      },
    }))
    .actions(self => ({
      afterAttach() {
        const { track } = self
        if (track) {
          self.trackId = track.configuration.trackId
          self.trackType = track.type
        }
      },
      /**
       * #action
       */
      setSequenceHoverPosition(pos: SequenceHoverPosition | undefined) {
        // skip no-op updates: mousemove fires per pixel but the base under the
        // cursor changes far less often, and each change re-renders the LGV
        // crosshair overlay
        const prev = self.sequenceHoverPosition
        const same =
          prev === pos ||
          (prev?.refName === pos?.refName &&
            prev?.start === pos?.start &&
            prev?.end === pos?.end)
        if (!same) {
          self.sequenceHoverPosition = pos
        }
      },
      /**
       * #action
       */
      setFeatureData(featureData: SimpleFeatureSerialized) {
        self.unformattedFeatureData = featureData
      },
      /**
       * #action
       */
      clearFeatureData() {
        self.unformattedFeatureData = undefined
      },
    }))
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      const { featureData, ...rest } = snap ?? {}
      return { unformattedFeatureData: featureData, ...rest }
    })
    .postProcessSnapshot(snap => {
      const { unformattedFeatureData, ...rest } = snap
      // JSON.stringify can return empty if too large
      const json = JSON.stringify(unformattedFeatureData)
      const tooLargeToPersist = !json || json.length > 2_000_000
      return {
        featureData: tooLargeToPersist ? undefined : unformattedFeatureData,
        ...rest,
      }
    })
}

export type BaseFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type BaseFeatureWidgetModel = Instance<BaseFeatureWidgetStateModel>
