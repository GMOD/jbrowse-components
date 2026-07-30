// `checkboxItem` / `radioItems` now live in `@jbrowse/core/ui` so every display
// gets the same keep-menu-open behavior, and `capitalizeFirst` in
// `@jbrowse/core/util` — callers hold `noun` lower-case because it also appears
// mid-sentence ("Longest reads first") and menu labels lead with a capital, the
// same reason the canvas display needs it. Re-exported here so the existing
// call sites in this folder keep their short local import.
export { checkboxItem, radioItems } from '@jbrowse/core/ui'
export { capitalizeFirst } from '@jbrowse/core/util'
