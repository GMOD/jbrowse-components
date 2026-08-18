// Compares the checked-in demos/<name>/config.json against what is actually
// live at jbrowse.org/demos/<name>/config.json.
//
// The repo copy exists because these configs used to live only in S3, hand-edited
// through `aws s3 cp` from whatever scratch file the editing session happened to
// build. That made a dropped track invisible in review and, on an unversioned
// bucket, unrecoverable: ecoli_pangenome lost its `ecoli_ava` track that way and
// four figures failed with "Could not resolve identifier".
//
// Comparison is on parsed JSON, not bytes, so prettier formatting the repo copy
// isn't reported as drift.
//
// Usage:
//   node scripts/check-demo-configs.ts          report drift, exit 1 if any
//   node scripts/check-demo-configs.ts --fix    pull live into the repo copies
//
// Not a PR gate: it needs the network and reports on state no commit controls
// (someone can upload at any time). It runs weekly instead, as a job in
// .github/workflows/links.yml, which is the sweep for exactly that shape of
// drift. Run it by hand before editing a demo config, and after deploying one.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { fix: { type: 'boolean' } },
  strict: true,
})

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const demosDir = path.join(repoRoot, 'demos')

// Every key under demos/ that has a config.json, so a new demo is picked up by
// adding its directory rather than by editing a list here.
const demos = fs
  .readdirSync(demosDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => fs.existsSync(path.join(demosDir, name, 'config.json')))
  .sort()

// Named tracks/assemblies are what a reader actually loses when a config is
// overwritten from a stale copy, so report those rather than a raw text diff.
function idsOf(config: unknown) {
  const c = config as {
    tracks?: { trackId?: string }[]
    assemblies?: { name?: string }[]
  }
  return {
    tracks: new Set((c.tracks ?? []).map(t => t.trackId ?? '<no trackId>')),
    assemblies: new Set((c.assemblies ?? []).map(a => a.name ?? '<no name>')),
  }
}

function missing(a: Set<string>, b: Set<string>) {
  return [...a].filter(x => !b.has(x))
}

let drifted = 0
for (const name of demos) {
  const file = path.join(demosDir, name, 'config.json')
  const url = `https://jbrowse.org/demos/${name}/config.json`
  const res = await fetch(url)
  if (!res.ok) {
    console.log(`✗ ${name}: HTTP ${res.status} fetching ${url}`)
    drifted++
    continue
  }
  const live = (await res.json()) as unknown
  const repo = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (JSON.stringify(repo) === JSON.stringify(live)) {
    console.log(`✓ ${name}`)
  } else {
    drifted++
    const l = idsOf(live)
    const r = idsOf(repo)
    console.log(`✗ ${name}: repo copy and ${url} differ`)
    for (const [what, onlyRepo, onlyLive] of [
      ['track', missing(r.tracks, l.tracks), missing(l.tracks, r.tracks)],
      [
        'assembly',
        missing(r.assemblies, l.assemblies),
        missing(l.assemblies, r.assemblies),
      ],
    ] as const) {
      if (onlyRepo.length) {
        console.log(`    ${what}s in repo but NOT live: ${onlyRepo.join(', ')}`)
      }
      if (onlyLive.length) {
        console.log(`    ${what}s live but NOT in repo: ${onlyLive.join(', ')}`)
      }
    }
    if (values.fix) {
      fs.writeFileSync(file, `${JSON.stringify(live, null, 2)}\n`)
      console.log('    pulled live into the repo copy')
    }
  }
}

if (drifted && !values.fix) {
  console.log(
    `\n${drifted} demo config(s) drifted. Reconcile before editing either side:\n` +
      '  --fix pulls live into the repo, scripts/deploy-demo.sh pushes the repo copy live.',
  )
  process.exit(1)
}
