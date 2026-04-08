#!/usr/bin/env node
/**
 * Generate docs/ACTIONS.md from the ACTION_MAP in ActionListener.ts.
 *
 * Parses the TypeScript source with a regex (good enough for this
 * file, which has a simple flat object literal). Emits a markdown
 * table grouping MST action names by their semantic ActionType.
 *
 * Run as part of `pnpm build` or manually:
 *   node scripts/generate_action_doc.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginRoot = resolve(__dirname, '..')

const listenerSrc = readFileSync(
  resolve(pluginRoot, 'src/ActionLogger/ActionListener.ts'),
  'utf8',
)

// Extract the ACTION_MAP block
const mapMatch = listenerSrc.match(
  /const ACTION_MAP:[^=]+=\s*\{([\s\S]*?)^\}/m,
)
if (!mapMatch) {
  console.error('Could not locate ACTION_MAP in ActionListener.ts')
  process.exit(1)
}

const body = mapMatch[1]

// Walk the body line by line, tracking section headers (// comments)
// and "name: ActionType.FOO" entries
const lines = body.split('\n')
const byType = new Map() // ActionType → [sourceAction, ...]
let currentSection = null
for (const raw of lines) {
  const line = raw.trim()
  if (!line) {
    currentSection = null
    continue
  }
  if (line.startsWith('//')) {
    currentSection = line.replace(/^\/+\s*/, '').trim()
    continue
  }
  const entry = line.match(/^(\w+):\s*ActionType\.(\w+),?/)
  if (entry) {
    const [, source, type] = entry
    if (!byType.has(type)) {
      byType.set(type, [])
    }
    byType.get(type).push({ source, section: currentSection })
  }
}

// Also extract metadata extraction switch cases for documentation
const metaMatch = listenerSrc.match(
  /private extractMetadata[^{]+\{[\s\S]*?switch \(name\) \{([\s\S]*?)^\s*\}\s*$/m,
)
const metaByAction = new Map()
if (metaMatch) {
  const body = metaMatch[1]
  const caseRegex = /case ['"](\w+)['"]:[^}]*?(?=case|default|\}$)/g
  let m
  while ((m = caseRegex.exec(body)) !== null) {
    const action = m[1]
    const block = m[0]
    // Find meta assignments
    const metaFields = [...block.matchAll(/meta\.(\w+)\s*=/g)].map(x => x[1])
    if (metaFields.length) {
      metaByAction.set(action, [...new Set(metaFields)])
    }
  }
}

// Emit markdown
let out = `# Action Vocabulary

This document is auto-generated from \`src/ActionLogger/ActionListener.ts\`.
Do not edit manually. Regenerate with:

    node scripts/generate_action_doc.mjs

The plugin classifies each captured MST action into a semantic
\`ActionType\`. Sub-actions (actions called internally by another action,
e.g. \`scrollTo\` inside \`zoomTo\`) are filtered out via MST's
\`parentActionEvent\` — only top-level user-initiated actions are recorded.

## Action types

`

const sortedTypes = [...byType.keys()].sort()
for (const type of sortedTypes) {
  const entries = byType.get(type)
  out += `### \`${type}\`\n\n`
  out += '| MST action | Captured metadata |\n'
  out += '|------------|------------------|\n'
  for (const { source } of entries) {
    const meta = metaByAction.get(source) ?? []
    const metaStr = meta.length ? meta.map(f => `\`${f}\``).join(', ') : '—'
    out += `| \`${source}\` | ${metaStr} |\n`
  }
  out += '\n'
}

out += `## Summary

- **${sortedTypes.length}** semantic action types
- **${[...byType.values()].reduce((n, xs) => n + xs.length, 0)}** MST action names mapped
- **${metaByAction.size}** actions with custom metadata extraction

## Adding a new action

1. Add the semantic type (if new) to \`ActionType\` enum in
   \`src/ActionLogger/ActionTypes.ts\`.
2. Add an entry to \`ACTION_MAP\` in \`src/ActionLogger/ActionListener.ts\`
   mapping the MST action name to the semantic type.
3. If the action has arguments worth capturing, add a \`case\` to
   \`extractMetadata()\` in the same file.
4. Regenerate this doc: \`node scripts/generate_action_doc.mjs\`.
`

const outPath = resolve(pluginRoot, 'docs/ACTIONS.md')
writeFileSync(outPath, out)
console.log(`Wrote ${outPath} (${out.length} bytes, ${sortedTypes.length} types)`)
