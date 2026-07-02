import { ConfigurationSchema } from '@jbrowse/core/configuration'
import {
  preprocessTrackConfigSnapshot,
  trackConfigActions,
} from '@jbrowse/core/pluggableElementTypes'
import { types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

// Deliberately a subset of createBaseTrackConfig's slots — it omits fields that
// don't make sense for the ReferenceSequenceTrack (assemblyNames, category,
// textSearching, formatDetails, ...). The snapshot preprocessing and
// addDisplayConf action are shared with the base track config.

/**
 * #config ReferenceSequenceTrack
 * used to display base level DNA sequence tracks
 *
 * #example
 * Usually authored as the `sequence` member of an assembly rather than a
 * top-level track:
 * ```js
 * sequence: {
 *   type: 'ReferenceSequenceTrack',
 *   trackId: 'hg38-ref',
 *   adapter: {
 *     type: 'IndexedFastaAdapter',
 *     uri: 'https://example.com/hg38.fa',
 *   },
 * }
 * ```
 */

export function createReferenceSeqTrackConfig(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'ReferenceSequenceTrack',
    {
      /**
       * #slot
       * configuration for track adapter
       */
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),

      /**
       * #slot
       * configuration for the displays e.g. LinearReferenceSequenceDisplay
       */
      displays: types.array(pluginManager.pluggableConfigSchemaType('display')),

      /**
       * #slot
       */
      name: {
        type: 'string',
        description:
          'optional track name, otherwise uses the "Reference sequence (assemblyName)"',
        defaultValue: '',
      },

      /**
       * #slot
       */
      sequenceType: {
        type: 'string',
        description: 'either dna or pep',
        defaultValue: 'dna',
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
      metadata: {
        type: 'frozen',
        description: 'anything to add about this track',
        defaultValue: {},
      },

      formatAbout: ConfigurationSchema('FormatAbout', {
        /**
         * #slot formatAbout.config
         */
        config: {
          type: 'frozen',
          description: 'formats configuration in about dialog',
          defaultValue: {},
          contextVariable: ['config'],
        },

        /**
         * #slot formatAbout.hideUris
         */
        hideUris: {
          type: 'boolean',
          defaultValue: false,
        },
      }),
    },
    {
      preProcessSnapshot: s => preprocessTrackConfigSnapshot(pluginManager, s),
      /**
       * #identifier
       */
      explicitIdentifier: 'trackId',
      explicitlyTyped: true,
      actions: trackConfigActions,
    },
  )
}
