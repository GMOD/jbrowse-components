import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  linearWiggleDisplayConfigSchema,
  summaryScoreModeConfigSchemaFields,
} from '@jbrowse/plugin-wiggle'

/**
 * #config LinearGCContentDisplay
 * #category display
 *
 * GC content (or GC skew) of a sequence, drawn as a quantitative plot: on a
 * `ReferenceSequenceTrack`, from the track's own sequence adapter, or as a
 * `GCContentTrack` of its own, whose `GCContentAdapter` wraps a sequence
 * adapter.
 *
 * #example
 * On the assembly's `sequence` track. `gcMode` is `content` for GC percentage
 * or `skew` for (G-C)/(G+C):
 * ```js
 * sequence: {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'refseq',
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/genome.fa',
 *   },
 *   displays: [
 *     {
 *       type: 'LinearGCContentDisplay',
 *       displayId: 'refseq-LinearGCContentDisplay',
 *       windowSize: 100,
 *       windowDelta: 100,
 *       gcMode: 'content',
 *     },
 *   ],
 * }
 * ```
 *
 * #example
 * As its own track, in GC-skew mode with a small, overlapping sliding window
 * (a `windowDelta` under `windowSize` overlaps the windows, which smooths the
 * signal):
 * ```js
 * {
 *   type: 'GCContentTrack',
 *   trackId: 'gc',
 *   name: 'GC content',
 *   assemblyNames: ['hg38'],
 *   adapter: { type: 'GCContentAdapter' },
 *   displayDefaults: { gcMode: 'skew', windowSize: 50, windowDelta: 10 },
 * }
 * ```
 */
export default function linearGCContentDisplayConfigSchema() {
  return ConfigurationSchema(
    'LinearGCContentDisplay',
    {
      /**
       * #slot
       * Number of bases per GC measurement window.
       */
      windowSize: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * Step between successive windows; smaller than `windowSize` means
       * overlapping windows (a smoother signal).
       */
      windowDelta: {
        type: 'number',
        defaultValue: 100,
      },
      /**
       * #slot
       * `content` for GC percentage, `skew` for (G-C)/(G+C) strand skew.
       */
      gcMode: {
        type: 'stringEnum',
        model: types.enumeration('gcMode', ['content', 'skew']),
        defaultValue: 'content',
      },
      ...summaryScoreModeConfigSchemaFields({
        defaultMode: 'avg',
        description:
          "GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces the above-origin colour on every bin (buildSourceRenderData skips the two-sided split for whiskers) and hides negative GC-skew as if it were positive",
      }),
    },
    {
      /**
       * #baseConfiguration
       */
      // Imported directly rather than fetched back out of the plugin registry
      // as `pluginManager.getDisplayType('LinearWiggleDisplay').configSchema`.
      // That is the identical object — the wiggle plugin registers the same
      // module-level const it exports — but the registry types it as
      // `AnyConfigurationSchemaType`, which widened this schema's base and so
      // erased slot-name and value checking for every read of a GC content
      // slot, including this schema's OWN `windowSize`/`windowDelta`/`gcMode`.
      // A widened base poisons the whole schema, so no annotation downstream
      // could recover it. gccontent already imports this barrel for the model
      // factory and the React component, so nothing new lands in the bundle.
      baseConfiguration: linearWiggleDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type LinearGCContentDisplayConfigSchema = ReturnType<
  typeof linearGCContentDisplayConfigSchema
>
