// Fails when a doc points at a figure the figure store does not have, or at a
// video the video store does not have.
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
import { readManifest as readVideoManifest, videoRoot } from './video-store.ts'

// Same shape check-captions.ts scans for: every <Figure> in the corpus is a
// self-closing tag with a src attribute.
const figureRe = /<Figure\b[^>]*?\bsrc="([^"]*)"[^>]*?>/g

// Site-relative, always under /img, the one form remark-figure.ts turns into an
// <img>. Anything else (an absolute URL to another host, a data: URI) is not
// this file's business.
const IMG_PREFIX = '/img/'

// A <Video> is the same hazard as a <Figure>, reached by the same route: the
// bytes are gitignored, `video:pull` installs what video.lock names, and astro
// copies static/ verbatim — so a clip that was filmed but never pushed builds
// green, deploys green, and 404s in the reader's browser. Checked here rather
// than in a script of its own because it is one question asked of two manifests.
//
// The POSTER is checked separately from the clip. An embed whose poster is
// missing still plays, so its failure is a black rectangle where the reader
// expected a picture, and nothing else would ever report it.
const videoRe = /<Video\b[^>]*?\bsrc="([^"]*)"[^>]*?>/g
const VIDEO_PREFIX = '/video/'

const manifest = readManifest()
const known = new Set(manifest.keys())
const videoManifest = readVideoManifest()

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
  videoRe.lastIndex = 0
  let videoMatch: RegExpExecArray | null
  while ((videoMatch = videoRe.exec(text)) !== null) {
    const src = videoMatch[1]!
    if (!src.startsWith(VIDEO_PREFIX)) {
      continue
    }
    checked++
    for (const want of [src, src.replace(/\.mp4$/, '.jpg')]) {
      const path = `${videoRoot}${want.slice(VIDEO_PREFIX.length - 1)}`
      if (!videoManifest.has(path)) {
        const kind = want.endsWith('.jpg') ? 'poster' : 'clip'
        problems.push(
          `${docRelative(file)}: <Video src="${src}"> names no ${kind} in video.lock (${path})` +
            '\n    Film it, then `pnpm video:push` and commit video.lock.',
        )
      }
    }
  }
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
    ? [
        `${problems.length} doc figure/video reference(s) name nothing:`,
        ...problems,
      ]
    : [],
  `${checked} doc figure and video references all resolve (${manifest.size} figures, ${videoManifest.size} video files in the store).`,
)
