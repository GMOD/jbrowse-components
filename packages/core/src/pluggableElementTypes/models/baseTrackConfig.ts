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
  adapter?: { type?: unknown }
  displays?: LegacyDisplaySnapshot[]
}

/**
 * Whether a track's adapter serves what a display type draws from: every
 * `adapterCapabilities` entry the display asks for, among those the adapter
 * type declares.
 */
export function adapterFeeds(
  pluginManager: PluginManager,
  adapter: TrackConfigSnapshot['adapter'],
) {
  const type = adapter?.type
  const capabilities = new Set(
    typeof type === 'string' && pluginManager.hasAdapterType(type)
      ? pluginManager.getAdapterType(type).adapterCapabilities
      : [],
  )
  return (display: { adapterCapabilities: readonly string[] }) =>
    display.adapterCapabilities.every(c => capabilities.has(c))
}

/**
 * The display types of `trackType` a track on `adapter` can draw as, in the
 * track type's order.
 */
export function displayTypesFedBy(
  pluginManager: PluginManager,
  trackType: string,
  adapter: TrackConfigSnapshot['adapter'],
) {
  return pluginManager
    .getTrackType(trackType)
    .displayTypes.filter(adapterFeeds(pluginManager, adapter))
    .map(d => d.name)
}

/**
 * The display types a view may open a track as, best first: those its adapter
 * feeds, the ones its config declares leading in declared order. A declared
 * display the adapter cannot feed stays in the config as settings and is never
 * a candidate.
 */
export function displayCandidates(
  pluginManager: PluginManager,
  track: {
    type: string
    adapter?: TrackConfigSnapshot['adapter']
    displays?: readonly { type: string }[]
  },
) {
  const declared = (track.displays ?? []).map(
    d => pluginManager.resolveDisplayTypeRecord(d.type)?.name ?? d.type,
  )
  const rank = (name: string) => {
    const i = declared.indexOf(name)
    return i === -1 ? declared.length : i
  }
  return displayTypesFedBy(pluginManager, track.type, track.adapter).sort(
    (a, b) => rank(a) - rank(b),
  )
}

/**
 * Snapshot normalization shared by every track config schema (including
 * ReferenceSequenceTrack). Loads retired display types as the displays they
 * retired into, runs the `Core-preProcessTrackConfig` extension point,
 * auto-fills a stub display for each of the track type's registered displays
 * whose adapter capabilities the track's adapter declares, folds the
 * `displayDefaults` shorthand into those entries, dedupes by type (first wins),
 * and lifts legacy renderer configs.
 */
export function preprocessTrackConfigSnapshot(
  pluginManager: PluginManager,
  snapshot: Record<string, unknown>,
) {
  const pre = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint Core-preProcessTrackConfig | sync | Rewrite a track config snapshot before it is instantiated */
    'Core-preProcessTrackConfig',
    migrateRetiredDisplays(pluginManager, structuredClone(snapshot)),
  ) as Partial<TrackConfigSnapshot>
  // a non-array `displays` would crash MST union-type probing
  const declared = Array.isArray(pre.displays) ? pre.displays : []
  let displays = declared
  if (pre.trackId !== 'placeholderId') {
    // The displays the config declared lead, in its order; every other one
    // the adapter feeds follows in the track type's own order.
    try {
      const declaredTypes = new Set(declared.map(d => d.type))
      const feeds = adapterFeeds(pluginManager, pre.adapter)
      displays = [
        ...declared,
        ...pluginManager
          .getTrackType(pre.type ?? '')
          .displayTypes.filter(d => !declaredTypes.has(d.name) && feeds(d))
          .map(d => ({ displayId: `${pre.trackId}-${d.name}`, type: d.name })),
      ]
    } catch (e) {
      throw new Error(
        `Unknown track type "${pre.type}" in ${JSON.stringify(pre)}`,
        { cause: e },
      )
    }
  }
  const snap = expandTrackConfigShorthand(
    { ...pre, displays },
    pluginManager,
  ) as TrackConfigSnapshot & { displays: LegacyDisplaySnapshot[] }
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
    displays: snap.displays
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
