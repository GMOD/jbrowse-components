// Fails on a screenshot spec whose mistake would otherwise produce a
// plausible-looking figure rather than an error — a duplicate name, a compose
// part naming no spec, fields an embedded capture silently ignores. The rules
// live in screenshot-specs.ts next to the spec list; this is the CI entry point,
// and generate-screenshots runs the same function before it renders anything.
//
// Needs no browser and no build, so it runs in `pnpm check-docs` with the rest
// of the validators. The rules themselves live in screenshot-spec-rules.ts,
// where screenshotSpecs.test.ts can reach them without importing the spec
// barrel — jest cannot transform the puppeteer ESM that barrel pulls in.
//
//   node website/scripts/check-specs.ts

import { reportProblems } from './check-utils.ts'
import {
  countDetachableLabels,
  countRawCallouts,
  validateSpecs,
} from './screenshot-spec-rules.ts'
import { specs } from './screenshot-specs.ts'

const problems = validateSpecs(specs)

// The raw-pixel ratchet, alongside them: a callout or a click that names a
// viewport coordinate instead of the thing it is aiming at. It cannot fail on
// the ones already there — they are deliberate, and countRawCallouts says which
// kinds — only on a NEW one, and it asks for the baseline back when one goes.
const { found, baseline } = countRawCallouts(specs)
const ratchet =
  found.length > baseline
    ? [
        `${found.length} hand-placed viewport coordinates in screenshot specs, up from ${baseline}.`,
        '  Anchor the new one instead: `anchor: {track, locus, fracY}` for data,',
        '  `{selector}`/`{text}` for chrome. See website/CLAUDE.md and',
        '  website/scripts/locusAnchor.ts for what a stale coordinate has cost.',
        ...found.map(entry => `  - ${entry}`),
      ]
    : found.length < baseline
      ? [
          `Only ${found.length} hand-placed viewport coordinates left, down from ${baseline}.`,
          '  Lower CALLOUT_BASELINE in screenshot-spec-rules.ts so the ratchet holds the gain.',
        ]
      : []

// The second ratchet: a label and the arrow leaving it, written as two
// annotations with the gap between them spelled out. Three committed figures
// have been sent back for the gap going wrong; `leader: true` on the text makes
// the pair one annotation that measures its own.
const labels = countDetachableLabels(specs)
const leaderRatchet =
  labels.found.length > labels.baseline
    ? [
        `${labels.found.length} label+arrow pairs in screenshot specs, up from ${labels.baseline}.`,
        '  Write the new one as one annotation: `leader: true` on the text, with',
        '  the anchor on what it names and `dx` placing the label off it. See',
        '  website/CLAUDE.md and reference/SCREENSHOT_CALLOUT_ANCHORS.md.',
        ...labels.found.map(entry => `  - ${entry}`),
      ]
    : labels.found.length < labels.baseline
      ? [
          `Only ${labels.found.length} label+arrow pairs left, down from ${labels.baseline}.`,
          '  Lower LEADER_BASELINE in screenshot-spec-rules.ts so the ratchet holds the gain.',
        ]
      : []

reportProblems(
  [
    ...(problems.length > 0
      ? [
          `${problems.length} screenshot spec problem(s):`,
          ...problems.map(problem => `  - ${problem}`),
        ]
      : []),
    ...ratchet,
    ...leaderRatchet,
  ],
  `${specs.length} screenshot specs are well formed, ${found.length} hand-placed coordinates and ${labels.found.length} label+arrow pairs left.`,
)
