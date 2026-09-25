import fs from 'node:fs'
import path from 'node:path'

import { createJbApi } from '@jbrowse/app-core'

import { CODE_TIMEOUT_DEFAULT_MS } from '../../electron/mcp/budgets.ts'
import {
  DOC_TOPICS,
  OMITTED_SECTIONS,
  SPLIT_TOPICS,
} from '../../electron/mcp/docLimits.ts'
import { overCap } from '../../electron/mcp/textCaps.ts'
import {
  MCP_TOOLS,
  SERVER_INSTRUCTIONS,
} from '../../electron/mcp/toolDefinitions.ts'

import type { DocTopic } from '../../electron/mcp/docLimits.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// The working discipline is written in several places — the server
// instructions, the tool description, the bundled guide, the repo skill and
// jb.help — and a helper renamed in jbApi.ts leaves the rest pointing at
// nothing. Every `jb.X` any copy names has to be a member the live object
// actually has. Lives in src/, not electron/mcp/: the node typecheck of
// electron/ has no DOM lib, and importing app-core from there drags the whole
// renderer into it.
const jb = createJbApi({ rootModel: {} } as unknown as PluginManager)
const repoRoot = path.join(__dirname, '../../../..')
const read = (file: string) =>
  fs.readFileSync(path.join(repoRoot, file), 'utf8')

// Every page the docs tool serves comes off DOC_TOPICS rather than a list here:
// `session-spec` and `automating` were served and checked by nothing, and a
// topic added there arrives in this run already.
const served = Object.fromEntries(
  Object.entries(DOC_TOPICS).map(([topic, t]) => [topic, read(t.file)]),
) as Record<DocTopic, string>
const guide = served['live-model']

const copies = {
  instructions: SERVER_INSTRUCTIONS,
  toolDescriptions: MCP_TOOLS.map(t => t.description).join('\n'),
  help: jb.help,
  ...served,
  overview: read('website/docs/agents.md'),
  skill: read('.claude/skills/jbrowse-mcp/SKILL.md'),
}

const roster = new Set(Object.keys(jb))

describe('the documentation names only jb members that exist', () => {
  for (const [name, text] of Object.entries(copies)) {
    it(name, () => {
      const named = [
        ...new Set([...text.matchAll(/\bjb\.(\w+)/g)].map(m => m[1]!)),
      ]
      expect(named.filter(n => !roster.has(n))).toEqual([])
    })
  }
})

// The converse of the check above, which is the drift that actually happened:
// `listTracks`' `limit` reached the guide and neither of the other two. The
// guide is the reference, so it names the whole roster. The copies an agent
// reads before any doc are deliberately partial — jb.help is a paragraph and
// the tool description is paid on every turn — so they pin the members whose
// absence is what produces a silently wrong answer, and nothing more.
// `setSession` earns its place the way the rest do: a review proposed cutting
// jb.help down to "the load-bearing members and the guide URL", which would
// have left a browser agent — the reader with no guide to follow — unable to
// edit a session as a document at all.
const LOAD_BEARING = [
  'addTrack',
  'describeSlots',
  'getFeatures',
  'inspect',
  'listTracks',
  'loadSessionSpec',
  'sessionSummary',
  'setSession',
  'trackModel',
  'view',
  'waitReady',
]

function namesIn(text: string) {
  return new Set([...text.matchAll(/\bjb\.(\w+)/g)].map(m => m[1]!))
}

it('the guide names every jb member', () => {
  const named = namesIn(guide)
  expect([...roster].filter(n => !named.has(n)).sort()).toEqual([])
})

// SERVER_INSTRUCTIONS is the shortest of the three and orients rather than
// enumerates, so `view` and `inspect` are the two it leaves to the tool
// description it arrives beside.
describe('the copies read before any doc name the load-bearing members', () => {
  const required = {
    help: LOAD_BEARING,
    toolDescriptions: LOAD_BEARING,
    instructions: LOAD_BEARING.filter(n => n !== 'view' && n !== 'inspect'),
  }
  for (const [copy, members] of Object.entries(required)) {
    it(copy, () => {
      const named = namesIn(copies[copy as keyof typeof copies])
      expect(members.filter(n => !named.has(n))).toEqual([])
    })
  }
})

// The same gate scripts/check-mcp-text-caps.ts runs in CI, here so the
// desktop package's own test run says so too. Past the cap the client cuts
// the text, and "read docs live-model FIRST" sat at the end of a 5 KB
// description, so no client ever showed it.
it('the copies a client shows the model fit under its cap', () => {
  expect(overCap()).toEqual([])
})

it('every copy stating the timeout default states the real one', () => {
  const expected = `${CODE_TIMEOUT_DEFAULT_MS / 1000}`
  for (const [name, text] of Object.entries(copies)) {
    for (const match of text.matchAll(/default (\d+)\s*s\b/g)) {
      expect(`${name}: ${match[1]}`).toBe(`${name}: ${expected}`)
    }
  }
})

// The file each topic names is bundled by esbuild through a static import, so a
// path that moved builds a server whose topic answers with nothing. Reading it
// here is the check: this run resolves the same paths off the repo.
it('every served topic names a file that is there', () => {
  for (const [topic, text] of Object.entries(served)) {
    expect(`${topic}: ${text.length > 0}`).toBe(`${topic}: true`)
  }
})

// The guide is what "read docs topic live-model FIRST" asks for, and it is
// 22 KB, so it is served as a contract plus a table of contents of the deep
// dives rather than whole or as headings alone. The headings the split and the
// omission name have to exist in the file, or the guide silently reverts to
// being served whole; docSections.test.ts holds the answer's size, where it can
// measure the real one.
it('the guide carries the headings the docs tool splits and omits it at', () => {
  expect(guide).toContain(`\n## ${SPLIT_TOPICS['live-model']}\n`)
  for (const heading of OMITTED_SECTIONS['live-model']!) {
    expect(guide).toContain(`\n## ${heading}\n`)
  }
})

// A filmed take lost five calls to the adapter probe coming back as a promise
it('the guide awaits the adapter probe, which is async', () => {
  expect(guide).toMatch(/await getAdapter\(/)
  expect(guide).not.toMatch(/[^t] getAdapter\(/)
})

// The one member whose options list has drifted twice, in the same direction
// both times: the guide gains an option and the two copies an agent reads
// FIRST do not. `viewId` missing from jb.help is the load-bearing case, since
// that string is the whole contract for a browser agent with no docs tool.
//
// agent-docs/ideas/waiting-on-a-call/one-generated-description-of-the-jb-surface.md parks
// generating all three from one source and names "a signature drifts a second
// time" as its trigger; this is the cheaper half of that, over the one
// signature that actually drifts.
describe('getFeatures names the same options everywhere', () => {
  function optionsIn(text: string) {
    const object = /jb\.getFeatures\(\{([^}]*)\}/.exec(text)
    return new Set(
      (object?.[1] ?? '')
        .split(',')
        .map(part => part.trim().replaceAll(/[?`]/g, ''))
        .filter(Boolean),
    )
  }
  const expected = optionsIn(guide)

  it('the guide names every option the implementation takes', () => {
    expect([...expected].sort()).toEqual([
      'assembly',
      'byteLimit',
      'loc',
      'regions',
      'trackId',
      'viewId',
    ])
  })

  for (const copy of ['help', 'toolDescriptions'] as const) {
    it(copy, () => {
      expect([...optionsIn(copies[copy])].sort()).toEqual([...expected].sort())
    })
  }
})
