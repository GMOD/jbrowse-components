import { types } from '@jbrowse/mobx-state-tree'

import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
  FormatDetailsConfigSchemaFactory,
} from '../../configuration/index.ts'
import { expandLooseSearchIndex } from '../../util/expandLooseSearchIndex.ts'
import { expandTrackConfigShorthand } from './expandTrackConfigShorthand.ts'
import { liftLegacyRendererConfig } from './migrateTrackConfig.ts'

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
 * ReferenceSequenceTrack). Runs the `Core-preProcessTrackConfig` extension
 * point, expands the `displayDefaults` shorthand, auto-fills a stub display for
 * each of the track type's registered displays, normalizes legacy display-type
 * aliases to their canonical name, dedupes by type (first wins), and lifts
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
      structuredClone(snapshot),
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
  const displayElements = pluginManager.getDisplayElements()
  const knownDisplayTypes = new Set(displayElements.map(d => d.name))
  // Map of legacy display type → canonical name, built from each DisplayType's
  // `aliases` declaration. Lets each display "own" its renames without a central
  // migration file.
  const displayAliasMap = new Map<string, string>()
  for (const d of displayElements) {
    if (d.aliases) {
      for (const alias of d.aliases) {
        displayAliasMap.set(alias, d.name)
      }
    }
  }
  // After alias normalization, dedupe by type so the track config holds one
  // display per type (old sessions can carry several display configs whose types
  // are all aliases of one canonical type). First occurrence wins to preserve
  // the default (displays[0]).
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
      .map(d => {
        const canonical = displayAliasMap.get(d.type)
        return canonical ? { ...d, type: canonical } : d
      })
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
         * over what `jbrowse text-index --tracks` built; `{ uri: 'genes.ix' }`
         * is enough, searching this track's assemblies. Without one, this
         * track's features are only findable through an assembly-wide search
         * adapter.
         */
        // Not `types.maybe(union)`: that unions the real type *before*
        // `optional(undefined)`, and every member here is all-default, so an
        // omitted key still resolved to the first registered one rather than
        // to nothing (see textSearchAdapterSlotOmission.test.ts). Listing the
        // undefined branch first is what actually wins the omitted-key default.
        textSearchAdapter: types.union(
          types.optional(types.undefined, undefined),
          pluginManager.pluggableConfigSchemaType('text search adapter'),
        ),
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
