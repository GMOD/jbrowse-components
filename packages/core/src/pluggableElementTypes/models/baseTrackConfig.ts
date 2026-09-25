import { types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
} from '../../configuration/index.ts'
import { expandLooseSearchIndex } from '../../util/expandLooseSearchIndex.ts'
import { expandTrackConfigShorthand } from './expandTrackConfigShorthand.ts'
import {
  liftLegacyRendererConfig,
  migrateRetiredDisplays,
} from './migrateTrackConfig.ts'

import type PluginManager from '../../PluginManager.ts'
import type { LegacyDisplaySnapshot } from './migrateTrackConfig.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

interface TrackConfigSnapshot {
  trackId: string
  name: string
  type: string
  assemblyNames?: unknown
  textSearching?: { textSearchAdapter?: unknown }
  displays?: LegacyDisplaySnapshot[]
}

/**
 * Snapshot normalization shared by every track config schema (including
 * ReferenceSequenceTrack). Loads retired display types as the displays they
 * retired into, runs the `Core-preProcessTrackConfig` extension point, expands
 * the `displayDefaults` shorthand, auto-fills a stub display for each of the
 * track type's registered displays, dedupes by type (first wins), and lifts
 * legacy renderer configs.
 */
export function preprocessTrackConfigSnapshot(
  pluginManager: PluginManager,
  snapshot: Record<string, unknown>,
) {
  const snap = expandTrackConfigShorthand(
    pluginManager.evaluateExtensionPoint(
      /** #extensionPoint Core-preProcessTrackConfig | sync | Rewrite a track config snapshot before it is instantiated */
      'Core-preProcessTrackConfig',
      migrateRetiredDisplays(pluginManager, structuredClone(snapshot)),
    ),
    pluginManager,
  ) as TrackConfigSnapshot
  // expandTrackConfigShorthand folds any `displayDefaults` shorthand into
  // `displays`, but its early-return branches can leave a malformed `displays`
  // untouched; guard so MST union-type probing never crashes on a non-array
  // `displays`.
  const displays = Array.isArray(snap.displays) ? snap.displays : []
  if (snap.trackId !== 'placeholderId') {
    // Add any of the track type's possible displays not already on the snapshot
    try {
      const configDisplayTypes = new Set(displays.map(d => d.type))
      for (const d of pluginManager.getTrackType(snap.type).displayTypes) {
        if (!configDisplayTypes.has(d.name)) {
          displays.push({
            displayId: `${snap.trackId}-${d.name}`,
            type: d.name,
          })
        }
      }
    } catch (e) {
      throw new Error(
        `Unknown track type "${snap.type}" in ${JSON.stringify(snap)}`,
        { cause: e },
      )
    }
  }
  const knownDisplayTypes = new Set(
    pluginManager.getDisplayElements().map(d => d.name),
  )
  // one display per type; the first keeps its place as the default
  const seenTypes = new Set<string>()
  const { textSearching } = snap
  return {
    ...snap,
    ...(textSearching?.textSearchAdapter
      ? {
          textSearching: {
            ...textSearching,
            textSearchAdapter: expandLooseSearchIndex(
              textSearching.textSearchAdapter,
              snap.assemblyNames,
            ),
          },
        }
      : {}),
    displays: displays
      .filter(d => {
        const known = knownDisplayTypes.has(d.type)
        if (!known) {
          console.warn(
            `Dropping display of unknown type "${d.type}" from track "${snap.trackId}": no registered display type has that name`,
          )
        }
        return known
      })
      .filter(d => {
        const dup = seenTypes.has(d.type)
        seenTypes.add(d.type)
        return !dup
      })
      .map(d => liftLegacyRendererConfig(d, snap.trackId)),
  }
}

/**
 * #config BaseTrack
 * Configuration shared by all track types. Concrete tracks (FeatureTrack,
 * AlignmentsTrack, VariantTrack, ...) extend this, so every track accepts these
 * fields in addition to its own.
 */
export function createBaseTrackConfig(pluginManager: PluginManager) {
  const none = types.optional(types.undefined, undefined)
  const adapter = pluginManager.pluggableConfigSchemaType('text search adapter')
  // A dispatcher rather than `types.maybe` or member order. Every adapter here
  // is all-default, so an omitted key has to resolve to nothing rather than the
  // first registered adapter (textSearchAdapterSlotOmission.test.ts). And
  // clearing a set slot, as undo does, must not hand `undefined` to the current
  // adapter's preProcessSnapshot, which MST's own matching does to test it.
  const optionalTextSearchAdapter = types.union(
    { dispatcher: snapshot => (snapshot === undefined ? none : adapter) },
    none,
    adapter,
  )
  return ConfigurationSchema(
    'BaseTrack',
    {
      /**
       * #slot
       */
      name: {
        description:
          'descriptive name of the track, falls back to the trackId when unset',
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       */
      assemblyNames: {
        description: 'name of the assembly (or assemblies) track belongs to',
        type: 'stringArray',
        defaultValue: ['assemblyName'],
      },
      /**
       * #slot
       */
      description: {
        description: 'a description of the track',
        type: 'string',
        defaultValue: '',
      },
      /**
       * #slot
       */
      category: {
        description: 'the category and sub-categories of a track',
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot
       */
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },
      /**
       * #slot
       * where this track's data comes from. Its `type` names the adapter for
       * the file format (`BamAdapter`, `Gff3TabixAdapter`, ...) and the rest of
       * the object is that adapter's own slots — see the adapter pages for
       * each. Most adapters also accept a `uri` shorthand in place of writing
       * their location slots out.
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      textSearching: ConfigurationSchema('textSearching', {
        /**
         * #slot textSearching.indexingAttributes
         */
        indexingAttributes: {
          type: 'stringArray',
          description:
            'list of which feature attributes to index for text searching',
          defaultValue: ['Name', 'ID', 'symbol'],
        },
        /**
         * #slot textSearching.indexingFeatureTypesToExclude
         */
        indexingFeatureTypesToExclude: {
          type: 'stringArray',
          description: 'list of feature types to exclude in text search index',
          defaultValue: ['CDS', 'exon'],
        },
        /**
         * #slot textSearching.indexingFeatureTypesToInclude
         * The only feature types to index, dropping every other type the file
         * carries. Empty (the default) means no allow list, i.e. index
         * everything `indexingFeatureTypesToExclude` does not name.
         *
         * Use this instead of the exclude list when the file draws from a
         * vocabulary you do not control. An NCBI RefSeq GFF3 uses 115 feature
         * types, 80 of them leaf records with nothing to search for — a `match`
         * is labelled with a bare UUID, a `cDNA_match` with an MD5, every
         * `biological_region` with the literal string "biological region" — so
         * a deny list leaks whichever type is added next, while the allow list
         * (gene, pseudogene, and the transcript types) does not grow. Both may
         * be set: this one admits, the exclude list then narrows.
         *
         * GFF3 only; the GTF and VCF indexers do not filter by type.
         */
        indexingFeatureTypesToInclude: {
          type: 'stringArray',
          description:
            'the only feature types to index; empty means index every type not excluded',
          defaultValue: [],
        },

        /**
         * #slot textSearching.textSearchAdapter
         * a per-track name search index, normally a `TrixTextSearchAdapter`
         * over what `jbrowse text-index --tracks` built; `'genes.ix'` is
         * enough, searching this track's assemblies. Without one, this
         * track's features are only findable through an assembly-wide search
         * adapter.
         */
        textSearchAdapter: optionalTextSearchAdapter,
      }),

      /**
       * #slot
       * An **array** of full display configs, e.g.
       * `displays: [{ type: 'LinearBasicDisplay', color: 'green' }]`. Each entry
       * names a display `type`; use this when you need exact control — your own
       * `displayId`, different settings for two displays, or choosing which
       * display is the default.
       *
       * For the common case, prefer the `displayDefaults` shorthand instead — an
       * object of appearance settings (e.g. `displayDefaults: { color: 'green' }`)
       * that JBrowse routes to whichever display uses each setting, so you don't
       * have to name the display or write the array.
       *
       * See the [track config guide](/docs/config_guides/tracks/#configuring-displays).
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),

      /**
       * #slot
       * jexl callbacks that add, rewrite or hide fields in this track's
       * feature-details panel. The same schema exists session-wide as
       * `configuration.formatDetails`.
       */
      formatDetails: FormatDetailsConfigSchemaFactory(),

      /**
       * #slot
       * jexl callbacks that add, rewrite or hide fields in this track's About
       * dialog. The same schema exists session-wide as
       * `configuration.formatAbout`.
       */
      formatAbout: FormatAboutConfigSchemaFactory(),
    },
    {
      preProcessSnapshot: s2 =>
        preprocessTrackConfigSnapshot(pluginManager, s2),
      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
    },
  )
}

export type BaseTrackConfigSchema = ReturnType<typeof createBaseTrackConfig>
export type BaseTrackConfig = Instance<BaseTrackConfigSchema>
