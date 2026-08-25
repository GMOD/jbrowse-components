import { execFileSync } from 'child_process'
import fs from 'fs'

const DIR =
  '/tmp/claude-1001/-home-cdiesh-src-jbrowse-components/262270f7-1cc8-4aa7-87fe-681ca886d010/scratchpad/tib'
const CAPTURE =
  '/home/cdiesh/src/jbrowse-components/.claude/worktrees/tiberius-review-demo/products/jbrowse-capture'
const INSTANCE = 'https://jbrowse.org/code/jb2/latest/'
const CONFIG = 'https://jbrowse.org/code/jb2/latest/test_data/config_demo.json'

const only = process.argv.slice(2)

// The evidence recipe, applied identically at every candidate. Bare trackIds:
// jbrowse.org/code/jb2/latest drops a track entry's inline display settings
// (verified — height and showOnlyGenes both had no effect), so the recipe is
// only as rich as that deployment reads.
const tracks = ['tiberius_grch38', 'gencode_47']

export function sessionFor(c) {
  return {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg38',
        loc: c.loc,
        tracks,
      },
    ],
  }
}

export function liveUrl(c) {
  const spec = encodeURIComponent(`spec-${JSON.stringify(sessionFor(c))}`)
  return `${INSTANCE}?config=${encodeURIComponent(CONFIG)}&session=${spec}&sessionName=${encodeURIComponent(`Tiberius review ${c.id}`)}`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const selected = JSON.parse(fs.readFileSync(`${DIR}/selected.json`, 'utf8'))
  fs.mkdirSync(`${DIR}/img`, { recursive: true })

  for (const c of selected) {
    if (only.length && !only.includes(c.id)) continue
    const specPath = `${DIR}/spec_${c.id}.json`
    const out = `${DIR}/img/${c.id}.png`
    fs.writeFileSync(specPath, JSON.stringify(sessionFor(c), null, 1))
    process.stdout.write(`${c.id} (${c.cls}) ${c.loc} ... `)
    try {
      execFileSync(
        'node',
        [
          'src/bin.ts',
          '--config',
          CONFIG,
          '--session',
          specPath,
          '--width',
          '1400',
          '--height',
          '400',
          '--scale',
          '2',
          '--settle',
          '1200',
          '--timeout',
          '90000',
          '-o',
          out,
        ],
        { cwd: CAPTURE, stdio: 'pipe', timeout: 300000 },
      )
      const kb = Math.round(fs.statSync(out).size / 1024)
      console.log(`ok (${kb} KB)`)
    } catch (e) {
      console.log(
        `FAILED: ${(e.stderr?.toString() || e.message).slice(0, 300)}`,
      )
    }
  }

  fs.writeFileSync(
    `${DIR}/links.json`,
    JSON.stringify(
      Object.fromEntries(selected.map(c => [c.id, liveUrl(c)])),
      null,
      1,
    ),
  )
}
