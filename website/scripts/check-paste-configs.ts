// A config a video tour types into the app's paste box has to be a config the
// page it sits on prints.
//
// `pangenome/hprc_end_to_end` films **Open track... → Add track from pasted
// JSON** with the HPRC segments track going into the box, and the whole of what
// that clip is worth is that a reader recognises the block from the page above
// it and pastes the same one. The two copies are a template literal in
// video-specs.ts and a fence in markdown, so nothing but this holds them
// together: reword the track `name`, rehost the `uri`, add one display slot to
// the block a reader copies, and the page moves while the film keeps showing
// the old text. Nobody re-reads a film.
//
// The comparison is the whole string rather than the parsed object, and
// deliberately: a reader copies characters. A fence reformatted by prettier and
// a spec string that was not are the same config and still not the same paste,
// and the fix for either is one edit.
//
// Run: `pnpm check-paste-configs`, or the root `pnpm check-docs`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { docsDir } from './paths.ts'
import { pastedTrackConfigs } from './video-specs.ts'

// Every ```json… fence body in a markdown file. The docs tag them `json`,
// `json addtrack` and `json session`, and all three are configs a tour could
// legitimately paste, so the prefix is what selects rather than the exact tag.
function jsonFences(text: string) {
  const bodies: string[] = []
  let open: string[] | undefined
  for (const line of text.split('\n')) {
    const fence = /^```(\S*)/.exec(line)
    if (!fence) {
      open?.push(line)
    } else if (open) {
      bodies.push(open.join('\n').trim())
      open = undefined
    } else if (fence[1]!.startsWith('json')) {
      open = []
    }
  }
  return bodies
}

// The first line that differs, so the report names the edit rather than
// printing two configs and leaving the reader to diff them. Compared against
// the CLOSEST fence — a page prints the same track more than once (the HPRC
// segments track appears three times, once per section that changes a slot on
// it), and the nearest of those is the one that drifted.
function firstDifference(want: string[], got: string[]) {
  const at = want.findIndex((line, i) => line !== got[i])
  return at === -1
    ? `the page's fence has ${got.length - want.length} extra line(s)`
    : `line ${at + 1}:\n      page: ${got[at] ?? '(end of fence)'}\n      tour: ${want[at]}`
}

function closest(want: string, fences: string[]) {
  const wantLines = want.split('\n')
  const shared = (f: string) =>
    f.split('\n').filter((line, i) => line === wantLines[i]).length
  return fences.reduce(
    (best, f) => (shared(f) > shared(best) ? f : best),
    fences[0] ?? '',
  )
}

const problems: string[] = []
for (const { video, doc, json } of pastedTrackConfigs) {
  const text = readFileSync(join(docsDir, doc), 'utf8')
  const fences = jsonFences(text)
  const want = json.trim()
  if (!fences.includes(want)) {
    const near = closest(want, fences)
    problems.push(
      `${doc} prints no fence matching the config ${video} types into the paste box\n` +
        `    ${near ? firstDifference(want.split('\n'), near.split('\n')) : 'the page has no json fence at all'}\n` +
        '    Make the two one text, then re-film the tour (`pnpm video --filter <name>`).',
    )
  }
}

reportProblems(
  problems.map(p => `  ${p}\n`),
  `${pastedTrackConfigs.length} pasted tour config(s) match a fence on their own page`,
)
