import fs from 'node:fs'
import path from 'node:path'

import { createJbApi } from '@jbrowse/app-core'

import { MCP_TOOLS, SERVER_INSTRUCTIONS } from './toolDefinitions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// The working discipline is written four times — the server instructions, the
// tool description, the bundled guide and the repo skill — and a helper
// renamed in jbApi.ts leaves three of them pointing at nothing. Every `jb.X`
// any copy names has to be a member the live object actually has.
const here = __dirname
const copies = {
  instructions: SERVER_INSTRUCTIONS,
  toolDescriptions: MCP_TOOLS.map(t => t.description).join('\n'),
  guide: fs.readFileSync(path.join(here, 'docs/live-model-guide.md'), 'utf8'),
  skill: fs.readFileSync(
    path.join(here, '../../../../.claude/skills/jbrowse-mcp/SKILL.md'),
    'utf8',
  ),
}

const roster = new Set(
  Object.keys(createJbApi({ rootModel: {} } as unknown as PluginManager)),
)

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

it('the guide awaits the adapter helper, which is async', () => {
  expect(copies.guide).toMatch(/await jb\.getFeatureAdapterOrThrow\(/)
  expect(copies.guide).not.toMatch(/[^t] jb\.getFeatureAdapterOrThrow\(\{/)
})
