import fs from 'node:fs'
import path from 'node:path'

import { createJbApi } from '@jbrowse/app-core'

import {
  MCP_TOOLS,
  SERVER_INSTRUCTIONS,
} from '../../electron/mcp/toolDefinitions.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// The working discipline is written four times — the server instructions, the
// tool description, the bundled guide and the repo skill — and a helper
// renamed in jbApi.ts leaves three of them pointing at nothing. Every `jb.X`
// any copy names has to be a member the live object actually has. Lives in
// src/, not electron/mcp/: the node typecheck of electron/ has no DOM lib, and
// importing app-core from there drags the whole renderer into it.
const mcpDir = path.join(__dirname, '../../electron/mcp')
const copies = {
  instructions: SERVER_INSTRUCTIONS,
  toolDescriptions: MCP_TOOLS.map(t => t.description).join('\n'),
  guide: fs.readFileSync(
    path.join(mcpDir, '../../../../website/docs/agents_live_model.md'),
    'utf8',
  ),
  skill: fs.readFileSync(
    path.join(mcpDir, '../../../../.claude/skills/jbrowse-mcp/SKILL.md'),
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
