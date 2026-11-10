import type { RetiredDisplayState } from '@jbrowse/core/pluggableElementTypes'

const ROWS = {
  showForward: 'forward',
  showReverse: 'reverse',
  showTranslation: 'translation',
} as const

/**
 * v4.3.0 held the row toggles as display state, which are each row's `show`
 * slot now. v4 defaulted every row on, so only a `false` lifts.
 */
export const retiredState: RetiredDisplayState = {
  keys: Object.keys(ROWS),
  lift: instance =>
    Object.fromEntries(
      Object.entries(ROWS)
        .filter(([key]) => instance[key] === false)
        .map(([, part]) => [part, { show: false }]),
    ),
}
