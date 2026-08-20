// Every string literal and JSX text node under a set of source roots, which is
// the closest thing to "what the app renders" a static scan can produce.
//
// Two checks read it. `check-menu-labels.ts` asks whether a menu path written in
// docs prose still names something; `check-spec-recipes.ts` asks the same of the
// labels the figure recipes copy out of an out-of-repo plugin, which nothing
// else in this repo would notice a rename of. Both take their roots rather than
// hardcoding them, so a plugin checkout is read by the same extraction as
// `plugins/` and cannot answer differently.
import { readFileSync } from 'node:fs'

import { walkFiles } from './check-utils.ts'

// Build output. Gitignored, so CI has none of it, and a `.d.ts` there would
// otherwise vouch for a name `src/` no longer has.
const BUILD_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build'])

export function sourceLabels(roots: string[]) {
  const labels = new Set<string>()
  const add = (raw: string) => {
    const t = raw
      .replaceAll('&apos;', "'")
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&')
      // JSX splits a label across `{' '}` to stop the formatter eating the space
      .replaceAll(/\{'\s*'\}/g, ' ')
      .replaceAll(/\s+/g, ' ')
      .trim()
    // 2, not 3: a segmented toggle's "On" is a real label a click path names,
    // and at a floor of 3 it could never be in the corpus however faithfully the
    // app rendered it — so the one check able to catch that pair being reworded
    // had to be told to skip it. The cost is that a 2-character path segment now
    // has a wider set to match against, which is a narrow way to be wrong
    // compared with a whole label class being unverifiable.
    if (t.length >= 2) {
      labels.add(t)
    }
  }
  for (const dir of roots) {
    for (const file of walkFiles(
      dir,
      name => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name),
      // Source only. `esm/` carries a `.d.ts` per module, which matched this
      // filter, so a renamed menu label went on being "found" in a stale local
      // build — in the one check whose entire purpose is catching renames. It
      // also made the answer depend on whether the developer had built, since
      // these directories are gitignored and CI has none of them.
      BUILD_DIRS,
    )) {
      const txt = readFileSync(file, 'utf8')
      for (const m of txt.matchAll(
        /(['"`])((?:(?!\1)[^\\\r\n]|\\.){2,90})\1/g,
      )) {
        add(m[2]!)
      }
      // JSX text nodes: >Some Label<
      for (const m of txt.matchAll(/>\s*([A-Z][^<>]{2,90}?)\s*</g)) {
        add(m[1]!)
      }
    }
  }
  return labels
}

// Case, trailing ellipsis and punctuation all vary between a label and the prose
// that names it; the words do not.
export const norm = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(/\.\.\.|…/g, '')
    .replaceAll(/[^a-z0-9 ]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
