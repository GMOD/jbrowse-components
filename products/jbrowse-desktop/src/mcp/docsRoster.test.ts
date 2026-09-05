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
