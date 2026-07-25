// Callers hold `noun` lower-case because it also appears mid-sentence
// ("Longest reads first"); menu labels lead with a capital.
export function capitalizeFirst(s: string) {
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`
}

// `checkboxItem` / `radioItems` now live in `@jbrowse/core/ui` so every display
// gets the same keep-menu-open behavior; re-exported here so the existing call
// sites in this folder keep their short local import.
export { checkboxItem, radioItems } from '@jbrowse/core/ui'
