import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import {
  linearWiggleDisplayConfigSchema,
  summaryScoreModeConfigSchemaFields,
} from '@jbrowse/plugin-wiggle'

// Deliberately carries no `#example` — the two concrete types do. `isBaseSchema`
// in the doc generator reads "extended by others, not itself registered as a
// DisplayType, and carrying no example" as the definition of a base schema, and
// only that reading stops this page's slot table from instructing
// `"type": "SharedGCContentDisplay"`, which nothing accepts. An example here
// would put it back.
/**
 * #config SharedGCContentDisplay
 * #category display
 *
 * Shared config for the two GC content displays: `LinearGCContentDisplay` (on a
 * `ReferenceSequenceTrack`, deriving GC from the track's own sequence adapter)
 * and `LinearGCContentTrackDisplay` (on a standalone `GCContentTrack`). Both
 * register the same slots against different track types, so the slots live here
 * once; a config always names one of the two concrete types.
 */
export default function sharedGCContentConfigSchema() {
  return ConfigurationSchema(
    'SharedGCContentDisplay',
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
          "GCContentAdapter never emits real per-bin min/max, so the inherited 'whiskers' default has no summary to draw — it just forces posColor-only rendering (buildSourceRenderData skips the bicolor pos/neg split for whiskers) and hides negative GC-skew as if it were positive",
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

export type SharedGCContentConfigSchema = ReturnType<
  typeof sharedGCContentConfigSchema
>
