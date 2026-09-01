// Drives a LOCAL jbrowse-web build from a real `claude -p --chrome` session,
// through the Claude in Chrome extension, and records the transcript. The
// proof the TODO row prove-window-jb-against-a-real-browser-agent asks for:
// nothing here authors the JavaScript, the agent finds window.jb itself with
// only the website page for guidance.
//
// Needs `pnpm --filter @jbrowse/web build` first, Chrome open with the Claude
// extension signed in, and the deviceId from list_connected_browsers.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import readline from 'node:readline'

const require = createRequire(import.meta.url)
const handler = require('serve-handler')

const HERE = path.dirname(new URL(import.meta.url).pathname)
const repoRoot = path.resolve(HERE, '../..')
const buildDir = path.join(repoRoot, 'products/jbrowse-web/build')
const outDir = path.resolve(process.argv[2] ?? 'web-demo')
const deviceId = process.argv[3]
if (!deviceId) {
  console.error('usage: webDemo.mjs <outdir> <deviceId>')
  process.exit(1)
}
fs.mkdirSync(outDir, { recursive: true })

const HG38 = 'https://jbrowse.org/ucsc/hg38/config.json'

const TURNS = [
  'Open hg38 at CDKN1A, with genes and vertebrate conservation.',
  'Add the human ATAC-seq from GEO that compares nutlin against a vehicle control, as one stacked track.',
  'Show me log2 nutlin over vehicle across this view, as its own track.',
  'Zoom to about 20kb around the biggest gain and check every track really drew.',
  'Report on the automation surface itself: which window.jb helpers you used, which threw or were missing, where the extension tools got in the way (result size, async, screenshots), and where you had to work around the page instead of using jb. Be specific and quote errors.',
]

function serveBuild() {
  const server = http.createServer((req, res) =>
    handler(req, res, {
      public: buildDir,
      cleanUrls: false,
      directoryListing: false,
    }),
  )
  return new Promise(resolve => {
    server.listen(0, () => {
      resolve({ port: server.address().port, close: () => server.close() })
    })
  })
}

const delay = ms => new Promise(r => setTimeout(r, ms))

const web = await serveBuild()
const appUrl = `http://localhost:${web.port}/`
console.log(`serving ${buildDir} at ${appUrl}`)

const systemPrompt = [
  fs.readFileSync(path.join(repoRoot, 'website/docs/agents_web.md'), 'utf8'),
  '',
  '# Reference for the shared jb library (from the MCP page)',
  fs.readFileSync(path.join(repoRoot, 'website/docs/agents_mcp.md'), 'utf8'),
  '',
  `# This session
The user's JBrowse Web instance is served at ${appUrl}. A hosted hg38 config is ${HG38}; open it as ${appUrl}?config=${HG38}. The only connected browser has deviceId ${deviceId}: call select_browser with it before the first browser action and do not ask which browser to use. Use javascript_tool for everything the page can answer; use screenshots to verify what drew. Do not use WebFetch or WebSearch; fetch from inside the page instead.`,
].join('\n')
const promptFile = path.join(outDir, 'system-prompt.md')
fs.writeFileSync(promptFile, systemPrompt)

const cwd = path.join(outDir, 'cwd')
fs.mkdirSync(cwd, { recursive: true })
const claude = spawn(
  'claude',
  [
    '-p',
    '--chrome',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--append-system-prompt-file',
    promptFile,
    '--allowedTools',
    'mcp__claude-in-chrome,ToolSearch',
    '--disallowedTools',
    'WebSearch,WebFetch,Task,Agent,TodoWrite,Bash,Read,Write,Edit,Glob,Grep',
  ],
  { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
)
claude.stderr.on('data', d => {
  process.stderr.write(`[claude] ${d}`)
})

const transcript = []
let turnDone
const turnFinished = () => new Promise(resolve => (turnDone = resolve))
let images = 0

readline.createInterface({ input: claude.stdout }).on('line', line => {
  let ev
  try {
    ev = JSON.parse(line)
  } catch {
    return
  }
  transcript.push(ev)
  if (ev.type === 'assistant') {
    for (const block of ev.message?.content ?? []) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(
          `  claude: ${block.text.trim().replaceAll(/\s+/g, ' ').slice(0, 160)}`,
        )
      }
      if (block.type === 'tool_use') {
        const arg = String(
          block.input?.text ?? block.input?.url ?? block.input?.action ?? '',
        )
          .trim()
          .replaceAll(/\s+/g, ' ')
        console.log(
          `  -> ${block.name.replace(/^mcp__[\w-]+?__/, '')} ${arg.slice(0, 120)}`,
        )
      }
    }
  }
  if (ev.type === 'user') {
    for (const block of ev.message?.content ?? []) {
      for (const part of Array.isArray(block.content) ? block.content : []) {
        if (part.type === 'image' && part.source?.data) {
          images++
          fs.writeFileSync(
            path.join(outDir, `shot-${String(images).padStart(2, '0')}.png`),
            Buffer.from(part.source.data, 'base64'),
          )
        }
      }
    }
  }
  if (ev.type === 'result') {
    console.log(`  [turn done in ${ev.duration_ms}ms]`)
    turnDone?.()
  }
})

try {
  for (const question of TURNS) {
    console.log(`\n=== ${question}`)
    const finished = turnFinished()
    claude.stdin.write(
      `${JSON.stringify({
        type: 'user',
        message: { role: 'user', content: question },
      })}\n`,
    )
    await finished
    fs.writeFileSync(
      path.join(outDir, 'transcript.json'),
      JSON.stringify({ questions: TURNS, events: transcript }, null, 2),
    )
    await delay(2000)
  }
  claude.stdin.end()
} finally {
  await delay(500)
  claude.kill()
  web.close()
}
console.log(`\n${images} screenshots, transcript -> ${outDir}`)
