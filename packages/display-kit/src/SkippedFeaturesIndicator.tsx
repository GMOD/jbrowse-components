import { pluralize } from '@jbrowse/core/util'

import TrackControl from './trackControl/TrackControl.tsx'

import type { SkippedFeatures } from './skippedFeatures.ts'

export { skippedFeatures } from './skippedFeatures.ts'
export type { SkippedFeatures, SkippedLayer } from './skippedFeatures.ts'

/**
 * The bottom-right notice for a display whose worker skipped features the
 * encoder could not place: a mistyped score field is otherwise an empty
 * track with no message. Renders nothing when nothing was skipped.
 */
export default function SkippedFeaturesIndicator({
  skipped,
  total,
  fields,
}: SkippedFeatures) {
  if (skipped === 0) {
    return null
  }
  const reason =
    fields.length > 0
      ? `${fields.map(f => `\`${f}\``).join(', ')} missing or not a number`
      : '`start` or `end` not a number'
  return (
    <TrackControl
      icon="filter"
      warning
      label={`${skipped.toLocaleString()} of ${total.toLocaleString()} skipped`}
      tooltip={`${skipped.toLocaleString()} of ${total.toLocaleString()} ${pluralize(total, 'feature')} skipped: ${reason}`}
    />
  )
}
