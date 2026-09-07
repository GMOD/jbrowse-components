import fs from 'node:fs'
import path from 'node:path'

import { createJbApi } from '@jbrowse/app-core'

import {
  CODE_TIMEOUT_DEFAULT_MS,
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

it('every copy stating the timeout default states the real one', () => {
  const expected = `${CODE_TIMEOUT_DEFAULT_MS / 1000}`
  for (const [name, text] of Object.entries(copies)) {
    for (const match of text.matchAll(/default (\d+)\s*s\b/g)) {
      expect(`${name}: ${match[1]}`).toBe(`${name}: ${expected}`)
    }
  }
})

it('the guide awaits the adapter helper, which is async', () => {
  expect(copies.guide).toMatch(/await jb\.getFeatureAdapterOrThrow\(/)
  expect(copies.guide).not.toMatch(/[^t] jb\.getFeatureAdapterOrThrow\(\{/)
})
