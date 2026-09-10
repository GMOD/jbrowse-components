import fs from 'node:fs'
import path from 'node:path'

import { createJbApi } from '@jbrowse/app-core'

import { CODE_TIMEOUT_DEFAULT_MS } from '../../electron/mcp/budgets.ts'
import { WHOLE_TOPICS } from '../../electron/mcp/docLimits.ts'
import { overCap } from '../../electron/mcp/textCaps.ts'
import {
  MCP_TOOLS,
  SERVER_INSTRUCTIONS,
} from '../../electron/mcp/toolDefinitions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// The working discipline is written in several places — the server
// instructions, the tool description, the bundled guide, the repo skill and
// jb.help — and a helper renamed in jbApi.ts leaves the rest pointing at
// nothing. Every `jb.X` any copy names has to be a member the live object
// actually has. Lives in src/, not electron/mcp/: the node typecheck of
// electron/ has no DOM lib, and importing app-core from there drags the whole
// renderer into it.
const jb = createJbApi({ rootModel: {} } as unknown as PluginManager)
const mcpDir = path.join(__dirname, '../../electron/mcp')
const copies = {
  instructions: SERVER_INSTRUCTIONS,
  toolDescriptions: MCP_TOOLS.map(t => t.description).join('\n'),
  help: jb.help,
  guide: fs.readFileSync(
    path.join(mcpDir, '../../../../website/docs/agents_live_model.md'),
    'utf8',
  ),
  recipes: fs.readFileSync(
    path.join(mcpDir, '../../../../website/docs/agents_recipes.md'),
    'utf8',
  ),
  // served as `docs topic:"hosted-data"` and named in the instructions, so a
  // renamed helper leaves it pointing at nothing exactly like the rest
  hostedData: fs.readFileSync(
    path.join(mcpDir, '../../../../website/docs/agents_hosted_data.md'),
    'utf8',
  ),
  overview: fs.readFileSync(
    path.join(mcpDir, '../../../../website/docs/agents.md'),
    'utf8',
  ),
  skill: fs.readFileSync(
    path.join(mcpDir, '../../../../.claude/skills/jbrowse-mcp/SKILL.md'),
    'utf8',
  ),
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
const LOAD_BEARING = [
  'addTrack',
  'describeSlots',
  'getFeatures',
  'inspect',
  'listTracks',
  'loadSessionSpec',
  'sessionSummary',
  'trackModel',
  'view',
  'waitReady',
]

function namesIn(text: string) {
  return new Set([...text.matchAll(/\bjb\.(\w+)/g)].map(m => m[1]!))
}

it('the guide names every jb member', () => {
  const named = namesIn(copies.guide)
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

// The guide is the one topic whose point is being read whole — it is what
// "read docs topic live-model FIRST" asks for, and past the size cap the docs
// tool would answer that with a table of contents, silently. It is exempt by
// name rather than by staying under a length, because it spent months 43
// characters from the line: every paragraph added to the contract had to be
// paid for by deleting one, and the check said so only after the edit.
it('the guide is served whole rather than as a table of contents', () => {
  expect([...WHOLE_TOPICS]).toContain('live-model')
})

it('the guide awaits the adapter helper, which is async', () => {
  expect(copies.guide).toMatch(/await jb\.getFeatureAdapterOrThrow\(/)
  expect(copies.guide).not.toMatch(/[^t] jb\.getFeatureAdapterOrThrow\(\{/)
})

// The one member whose options list has drifted twice, in the same direction
// both times: the guide gains an option and the two copies an agent reads
// FIRST do not. `viewId` missing from jb.help is the load-bearing case, since
// that string is the whole contract for a browser agent with no docs tool.
//
// agent-docs/ideas/one-generated-description-of-the-jb-surface.md parks
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
  const expected = optionsIn(copies.guide)

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
