import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getSession } from '../util/index.ts'
import { ElementId } from '../util/types/mst.ts'
import { SequenceFeatureDetailsF } from './SequenceFeatureDetails/model.ts'
import { applyFormatDetails, formatDetailsNumber } from './formatDetails.ts'
import { nullReplacer } from './util.tsx'

import type PluginManager from '../PluginManager.ts'
import type {
  ParentFeatureSummary,
  SimpleFeatureSerialized,
} from '../util/index.ts'
import type { SequenceHoverPosition } from './SequenceFeatureDetails/model.ts'
import type { Descriptors, MaybeSerializedFeat } from './types.tsx'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel BaseFeatureWidget
 * displays data about features, allowing configuration callbacks to modify the
 * contents of what is displayed
 *
 * see: formatDetails-\>feature,formatDetails-\>subfeatures
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
       */
      featureData: types.optional(
        types.frozen<MaybeSerializedFeat>(),
        undefined,
      ),

      /**
       * #property
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
      maxDepth: types.maybe(types.number),

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
      error: unknown
      sequenceHoverPosition: SequenceHoverPosition | undefined
    }>(() => ({
      /**
       * #volatile
       */

      error: undefined,
      /**
       * #volatile
       * genomic base currently hovered in this widget's sequence panel, read by
       * the LGV crosshair overlay
       */
      sequenceHoverPosition: undefined,
    }))

    .actions(self => ({
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
        self.featureData = undefined
      },
      /**
       * #action
       */
      setFormattedData(feat: SimpleFeatureSerialized) {
        self.featureData = feat
      },
      /**
       * #action
       */
      setTrackInfo(type?: string, trackId?: string) {
        self.trackId = trackId
        self.trackType = type
      },
      /**
       * #action
       */
      setMaxDepth(maxDepth?: number) {
        self.maxDepth = maxDepth
      },
      /**
       * #action
       */
      setError(e: unknown) {
        self.error = e
      },
    }))
    .actions(self => ({
      afterCreate() {
        addDisposer(
          self,
          autorun(
            function featureWidgetAutorun() {
              const { track } = self
              // read before any config read so the catch below can attribute
              // the failure without repeating one that may be what threw
              let trackId: string | undefined
              try {
                const { unformattedFeatureData } = self
                const session = getSession(self)
                if (track) {
                  trackId = track.configuration.trackId
                  self.setTrackInfo(track.type, trackId)
                }
                // both tiers apply: a widget can outlive its track
                // (safeReference) or never have had one, and the session-wide
                // `configuration.formatDetails` still means something. The
                // reads stay here in the autorun body rather than moving into
                // an action, which would run untracked
                const tiers = { session, track }
                // an unset maxDepth is the meaningful value, not a missing one:
                // the panel reads it as no nesting limit
                self.setMaxDepth(formatDetailsNumber(tiers, 'maxDepth'))
                if (unformattedFeatureData) {
                  self.setFormattedData(
                    applyFormatDetails(tiers, unformattedFeatureData),
                  )
                }
              } catch (e) {
                // jexl throws a bare parse/eval message with nothing naming the
                // slot or the config it came from, and this banner replaces the
                // whole panel -- say where to look
                const where = trackId
                  ? `track "${trackId}"`
                  : 'the session configuration'
                const err = new Error(
                  `Error running the formatDetails callbacks for ${where}: ${e}`,
                  { cause: e },
                )
                console.error(err)
                self.setError(err)
              }
            },
            { name: 'FeatureWidget' },
          ),
        )
      },
    }))
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) => {
      // old snapshots used `featureData`, new ones use `finalizedFeatureData`;
      // accept both for backwards compat
      const { featureData, finalizedFeatureData, ...rest } = (snap ?? {}) as {
        featureData?: MaybeSerializedFeat
        finalizedFeatureData?: MaybeSerializedFeat
      } & Record<string, unknown>
      return {
        unformattedFeatureData: featureData,
        featureData: finalizedFeatureData,
        ...rest,
      }
    })
    .postProcessSnapshot(snap => {
      const { unformattedFeatureData, featureData, ...rest } = snap

      // JSON.stringify can return empty if too large
      const s2 = JSON.stringify(featureData, nullReplacer)
      const featureTooLargeToBeSerialized = !s2 || s2.length > 2_000_000

      // `finalizedFeatureData` is persisted (rather than `featureData`) so
      // loading from snapshot doesn't re-run the formatter callbacks
      return {
        finalizedFeatureData: featureTooLargeToBeSerialized
          ? undefined
          : JSON.parse(s2),
        ...rest,
      }
    })
}

export type BaseFeatureWidgetStateModel = ReturnType<typeof stateModelFactory>
export type BaseFeatureWidgetModel = Instance<BaseFeatureWidgetStateModel>
