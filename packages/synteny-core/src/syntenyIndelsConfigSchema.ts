import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import { encodingOptions } from '@jbrowse/display-kit/colorConfigSchema'

import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #config SyntenyIndels
 * #category view
 * The linear synteny and dotplot views' `indels` part: the insertions and
 * deletions inside each alignment, read from its CIGAR. `show: false` draws
 * each alignment as one block or one straight segment; an opacity of 0 leaves
 * each indel a gap.
 *
 * #example
 * ```js
 * { type: 'LinearSyntenyView', indels: { show: false } }
 * ```
 * ```js
 * { type: 'LinearSyntenyView', indels: { encoding: { opacity: 0 } } }
 * ```
 */
export const syntenyIndelsConfigSchema = ConfigurationSchema(
  'SyntenyIndels',
  {
    /**
     * #slot
     */
    show: {
      type: 'boolean',
      defaultValue: true,
      description:
        'draw the indels inside each alignment; off draws each alignment as one block',
    },
    /**
     * #slot encoding
     * The part's channels: `encoding.opacity`.
     */
    encoding: ConfigurationSchema(
      'SyntenyIndelsEncoding',
      {
        /**
         * #slot encoding.opacity
         * `0` leaves each indel a gap; unset, or any other value, paints it
         * in its operation's color.
         */
        opacity: ConfigurationSchema(
          'SyntenyIndelsOpacity',
          {
            /**
             * #slot
             */
            value: {
              type: 'maybeNumber',
              description:
                "0 leaves each indel a gap; unset, or any other value, paints it in its operation's color",
            },
          },
          { shorthand: 'value', writes: 'whole', closed: true },
        ),
      },
      encodingOptions,
    ),
  },
  { closed: true },
)

/** How an `indels` part draws: not at all, as gaps, or in their op colors. */
export type IndelsDrawing = 'off' | 'matches' | 'full'

/** The drawing an `indels` part's settings resolve to. */
export function indelsDrawingOf(
  indels: Instance<typeof syntenyIndelsConfigSchema>,
): IndelsDrawing {
  return !readConfObject(indels, 'show')
    ? 'off'
    : readConfObject(indels, ['encoding', 'opacity', 'value']) === 0
      ? 'matches'
      : 'full'
}

/** An `indels` part as a view snapshot writes it. */
export interface IndelsArg {
  show?: boolean
  encoding?: { opacity?: number | { value?: number } }
}

/** An `indels` part written as plain settings, with its defaults filled. */
export function resolvedIndels(indels: IndelsArg = {}) {
  const conf = syntenyIndelsConfigSchema.create(indels)
  return {
    drawing: indelsDrawingOf(conf),
    settings: {
      show: readConfObject(conf, 'show'),
      encoding: {
        opacity: {
          value: readConfObject(conf, ['encoding', 'opacity', 'value']),
        },
      },
    },
  }
}

/** The `indels` snapshot that draws `drawing`. */
export function indelsOfDrawing(drawing: IndelsDrawing) {
  return drawing === 'off'
    ? { show: false }
    : drawing === 'matches'
      ? { encoding: { opacity: { value: 0 } } }
      : {}
}
