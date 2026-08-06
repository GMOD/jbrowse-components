// The handful of directories every generator and validator in here re-derived
// from `import.meta.dirname`. Kept apart from check-utils.ts on purpose: that
// module is imported by scripts/api-docs, whose helpers are jest-tested and so
// get transformed to CJS, which cannot parse `import.meta` (see the note in
// api-docs/format.ts). Everything here is node-only.
import { join } from 'node:path'

export const websiteDir = join(import.meta.dirname, '..')
export const repoRoot = join(websiteDir, '..')
export const docsDir = join(websiteDir, 'docs')
export const distDir = join(websiteDir, 'dist')
