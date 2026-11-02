import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { pileupConfigSchema } from '@jbrowse/plugin-alignments'

/**
 * #config LGVSyntenyPileup
 * #category display
 * The LGVSyntenyDisplay's `pileup` setting: the [Pileup](../pileup) object
 * with `collapsed` defaulting to on, so an all-vs-all track faceted by mate
 * assembly draws each mate genome as one band, repeat depth shown as darker
 * shading rather than as extra rows. The alignments display defaults it off,
 * where a section is a read category and the stack is the information.
 *
 * #example
 * ```js
 * { type: 'LGVSyntenyDisplay', pileup: { collapsed: false } }
 * ```
 */
export const lgvSyntenyPileupConfigSchema = ConfigurationSchema(
  'LGVSyntenyPileup',
  {
    /**
     * #slot collapsed
     */
    collapsed: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw each facet section as a single row rather than a stack',
    },
  },
  {
    /**
     * #baseConfiguration
     */
    baseConfiguration: pileupConfigSchema,
    closed: true,
  },
)
