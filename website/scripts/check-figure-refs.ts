// Fails when a doc points at a figure the figure store does not have.
//
//   node website/scripts/check-figure-refs.ts
//
// This is the backstop the store arrangement removed and never replaced. While
// figure bytes were tracked, a `<Figure src>` naming a file nobody had made was
// a missing path in `git status` and an obviously absent file in the tree. Now
// the bytes are gitignored and installed by `figures:pull`, so the ONLY record
// that a figure exists is its figures.lock line, and nothing checked a doc
// against it. Astro copies `static/` verbatim as its publicDir without
// consulting anything, so a doc naming a figure that was never pushed builds
// green, deploys green, and 404s in the reader's browser.
//
// Two live ways to reach that state, both quiet:
//
//   A regen nobody pushed. The figure is on the author's disk, so every local
//   build and every local review looks right, and the site serves nothing. The
//   sweep's NOT IN THE FIGURE STORE report is the warning. This is the gate.
//
//   A manifest line dropped by an unfiltered `figures push` from an incomplete
//   worktree. `push` now refuses that outright (see figures.ts), but the refusal
//   protects the writer's worktree, not a doc that starts naming a figure which
//   was already gone.
//
// Deliberately asks figures.lock rather than the filesystem: a checkout that has
// not pulled would answer "nothing is here" to every question, which is how the
// review baseline stayed dead for months. The manifest is the same answer on
// every machine, and `figures:pull` in the same CI job already proves the
// manifest's bytes are real.
//
// SCOPE, so nobody reads a green run as more than it is: hand-written <Figure>
// tags under website/docs, which is the same corpus check-captions.ts and
// audit-figures.ts walk. The gallery and the home page name figures through a
// spec rather than a path (src/lib/gallery.ts), and their images are generated
// into gitignored directories the store excludes. That is a different question,
// and gen-gallery-thumbs --check already asks it.
import { readFileSync } from 'node:fs'

import { docFiles, reportProblems } from './check-utils.ts'
import { readManifest } from './figure-paths.ts'
import { figureName } from './figure-store.ts'
import { docRelative, docsDir } from './paths.ts'

// Same shape check-captions.ts scans for: every <Figure> in the corpus is a
// self-closing tag with a src attribute.
const figureRe = /<Figure\b[^>]*?\bsrc="([^"]*)"[^>]*?>/g

// Site-relative, always under /img, the one form remark-figure.ts turns into an
// <img>. Anything else (an absolute URL to another host, a data: URI) is not
// this file's business.
const IMG_PREFIX = '/img/'

const manifest = readManifest()
const known = new Set(manifest.keys())

// name -> a path the manifest does have, for the near-miss hint below. A figure
// usually goes missing by extension or by directory, not by name, and saying
// which one exists turns "no such figure" into a one-line fix.
const byName = new Map<string, string>()
for (const path of known) {
  byName.set(figureName(path), path)
}

const problems: string[] = []
let checked = 0

for (const file of docFiles(docsDir)) {
  const text = readFileSync(file, 'utf8')
  figureRe.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = figureRe.exec(text)) !== null) {
    const src = match[1]!
    if (!src.startsWith(IMG_PREFIX)) {
      continue
    }
    checked++
    const path = `website/static${src}`
    if (known.has(path)) {
      continue
    }
    const sameName = byName.get(figureName(path))
    problems.push(
      `${docRelative(file)}: <Figure src="${src}"> names no figure in figures.lock${
        sameName
          ? `\n    (the manifest has ${sameName}, so check the extension)`
          : '\n    Render it, then `pnpm figures:push` and commit figures.lock.'
      }`,
    )
  }
}

reportProblems(
  problems.length > 0
    ? [`${problems.length} doc figure reference(s) name nothing:`, ...problems]
    : [],
  `${checked} doc figure references all resolve (${manifest.size} figures in the store).`,
)
