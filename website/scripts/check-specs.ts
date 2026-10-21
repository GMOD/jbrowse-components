// Fails on a screenshot spec mistake that would otherwise produce a
// plausible-looking figure, and holds the spec ratchets. The rules live in
// screenshot-spec-rules.ts and specSessionSchema.ts; generate-screenshots runs
// them too before it renders.
//
//   node website/scripts/check-specs.ts

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { reportProblems } from './check-utils.ts'
import { localConfigPath, specFileOwners } from './screenshot-impact.ts'
import {
  LONG_DELAY_MS,
  countDetachableLabels,
  countLongDelays,
  countRawCallouts,
  shadowedSessionTracks,
  validateSpecs,
} from './screenshot-spec-rules.ts'
import { specs } from './screenshot-specs.ts'
import {
  redundantDisplayTypes,
  sessionSchemaProblems,
} from './specSessionSchema.ts'

function configTrackIds(config: string) {
  const local = localConfigPath(config)
  if (!local) {
    return undefined
  }
  const { tracks = [] } = JSON.parse(
    readFileSync(join(local.root, local.rel), 'utf8'),
  ) as { tracks?: { trackId: string }[] }
  return new Set(tracks.map(t => t.trackId))
}

// A spec module the barrel does not import renders nothing and fails nothing.
const listed = new Set(specs.map(spec => spec.name))
const unlisted = [...(await specFileOwners())]
  .filter(([name]) => !listed.has(name))
  .map(
    ([name, file]) =>
      `${name} (${file}) is not in screenshot-specs.ts's \`specs\`, so nothing renders it`,
  )

const problems = [
  ...unlisted,
  ...validateSpecs(specs),
  ...shadowedSessionTracks(specs, configTrackIds),
  ...sessionSchemaProblems(specs),
  ...redundantDisplayTypes(specs),
]

// A ratchet fails on a new entry and asks for its baseline back when one goes;
// the entries already there are deliberate or wait on a reshoot.
interface Ratchet {
  what: string
  baselineName: string
  advice: string[]
  count: { found: string[]; baseline: number }
}

const ratchets: Ratchet[] = [
  {
    what: 'hand-placed viewport coordinates',
    baselineName: 'CALLOUT_BASELINE',
    advice: [
      'Anchor the new one instead: `anchor: {trackId, loc, fracY}` for data,',
      '`{selector}`/`{text}` for chrome. See website/scripts/locusAnchor.ts',
      'for what a stale coordinate has cost.',
    ],
    count: countRawCallouts(specs),
  },
  {
    what: 'label+arrow pairs',
    baselineName: 'LEADER_BASELINE',
    advice: [
      'Write the new one as one annotation: `leader: true` on the text, with',
      'the anchor on what it names and `dx` placing the label off it. See',
      'reference/FIGURE_CAPTURE.md.',
    ],
    count: countDetachableLabels(specs),
  },
  {
    what: `delays of ${LONG_DELAY_MS}ms or more`,
    baselineName: 'LONG_DELAY_BASELINE',
    advice: [
      'Wait on app work with `{ type: "waitForAppSettled" }`; measure the',
      'conversion with `PROBE_SPEC=<name> node scripts/probe-app-settled.ts`.',
    ],
    count: countLongDelays(specs),
  },
]

function ratchetProblems({ what, baselineName, advice, count }: Ratchet) {
  const { found, baseline } = count
  return found.length > baseline
    ? [
        `${found.length} ${what} in screenshot specs, up from ${baseline}.`,
        ...advice.map(line => `  ${line}`),
        ...found.map(entry => `  - ${entry}`),
      ]
    : found.length < baseline
      ? [
          `Only ${found.length} ${what} left, down from ${baseline}.`,
          `  Lower ${baselineName} in screenshot-spec-rules.ts so the ratchet holds the gain.`,
        ]
      : []
}

reportProblems(
  [
    ...(problems.length > 0
      ? [
          `${problems.length} screenshot spec problem(s):`,
          ...problems.map(problem => `  - ${problem}`),
        ]
      : []),
    ...ratchets.flatMap(ratchetProblems),
  ],
  `${specs.length} screenshot specs are well formed; left: ${ratchets
    .map(r => `${r.count.found.length} ${r.what}`)
    .join(', ')}.`,
)
