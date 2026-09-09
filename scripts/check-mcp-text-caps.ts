// Fails when the JBrowse Desktop MCP server's instructions or any tool
// description is longer than what the MCP clients show the model.
//
// Claude Code cuts each of them at 2048 characters and appends "… [truncated]":
//   - CHANGELOG.md, 2.1.84: "MCP tool descriptions and server instructions are
//     now capped at 2KB to prevent OpenAPI-generated servers from bloating
//     context" (https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
//   - reproduced on 2.1.266 (2026-09-09): with `--debug`, the log reads
//     `Server instructions truncated from 3000 to 2048 chars` and
//     `Tool "noop" description truncated from 2600 to 2048 chars`. `--probe`
//     below repeats that against whichever `claude` is installed, so the
//     number can be re-checked when the client changes.
// The Claude Code docs do not state the cap (checked 2026-09-09). Claude
// Desktop never shows the model the instructions at all
// (https://github.com/anthropics/claude-ai-mcp/issues/93), so there the tool
// description is the whole briefing until the agent calls `docs`.
//
// Before this check the instructions had drifted to 2.7 KB and the
// run_javascript description to 5 KB, with "read docs live-model first" as its
// last sentence — cut by every client. Source-only and instant, so it rides
// lint's checkout in push.yml.
//
// Run: pnpm check-mcp-text-caps            (the gate)
//      pnpm check-mcp-text-caps --probe    (measure the installed Claude Code)
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { overCap } from '../products/jbrowse-desktop/electron/mcp/textCaps.ts'
import {
  CLIENT_TEXT_CAP_CHARS,
  SERVER_INSTRUCTIONS,
} from '../products/jbrowse-desktop/electron/mcp/toolDefinitions.ts'

function probe() {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-cap-probe-'))
  const over = CLIENT_TEXT_CAP_CHARS + 1000
  const server = join(dir, 'server.mjs')
  writeFileSync(
    server,
    `import readline from 'node:readline'
const respond = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\\n')
readline.createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line)
  if (m.id === undefined) return
  if (m.method === 'initialize') respond(m.id, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'capprobe', version: '0' }, instructions: 'I'.repeat(${over}) })
  else if (m.method === 'tools/list') respond(m.id, { tools: [{ name: 'noop', description: 'D'.repeat(${over}), inputSchema: { type: 'object', properties: {} } }] })
  else respond(m.id, {})
})
`,
  )
  const config = join(dir, 'mcp.json')
  writeFileSync(
    config,
    JSON.stringify({
      mcpServers: { capprobe: { command: 'node', args: [server] } },
    }),
  )
  const run = spawnSync(
    'claude',
    [
      '--debug',
      '--mcp-config',
      config,
      '--strict-mcp-config',
      '--max-turns',
      '1',
      '--model',
      'haiku',
      '-p',
      'Reply with the single word done.',
    ],
    { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  )
  if (run.status !== 0) {
    console.error(run.stderr)
    throw new Error(`claude exited ${run.status}`)
  }
  const version = spawnSync('claude', ['--version'], {
    encoding: 'utf8',
  }).stdout.trim()
  const lines = newestDebugLog()
    .split('\n')
    .filter(l => l.includes('capprobe') && l.includes('truncated from'))
  console.log(`claude ${version}`)
  console.log(lines.length ? lines.join('\n') : 'no truncation logged')
  const seen = new Set(lines.map(l => /to (\d+) chars/.exec(l)?.[1]))
  if (seen.size !== 1 || !seen.has(String(CLIENT_TEXT_CAP_CHARS))) {
    throw new Error(
      `CLIENT_TEXT_CAP_CHARS is ${CLIENT_TEXT_CAP_CHARS}; the installed client cut at ${[...seen].join(', ') || 'nothing'}`,
    )
  }
  console.log(`cap confirmed at ${CLIENT_TEXT_CAP_CHARS} chars`)
}

function newestDebugLog() {
  const home = process.env.HOME ?? ''
  const candidates = ['.claude/debug', '.claude2/debug']
    .map(d => join(home, d))
    .flatMap(d => {
      try {
        return readdirSync(d)
          .filter(f => f.endsWith('.txt'))
          .map(f => join(d, f))
      } catch {
        return []
      }
    })
    .map(f => ({ f, mtime: statSync(f).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  if (!candidates[0]) {
    throw new Error('no Claude Code debug log found under ~/.claude*/debug')
  }
  return readFileSync(candidates[0].f, 'utf8')
}

if (process.argv.includes('--probe')) {
  probe()
} else {
  const over = overCap()
  for (const { name, length, cap } of over) {
    console.error(
      `${name}: ${length} chars, over the ${cap} the client shows the model`,
    )
  }
  if (over.length > 0) {
    console.error(
      'Cut it, and keep the must-read sentence first: see products/jbrowse-desktop/electron/mcp/README.md, "What each client shows the model".',
    )
    process.exit(1)
  }
  console.log(
    `instructions ${SERVER_INSTRUCTIONS.length} chars; every client text under ${CLIENT_TEXT_CAP_CHARS}`,
  )
}
