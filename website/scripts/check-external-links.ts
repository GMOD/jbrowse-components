// Probes every external URL written anywhere in the repo — docs prose, tutorial
// reproduce scripts, demo and test configs, screenshot specs — and fails on the
// ones that are gone.
//
// `check-links.ts` is the internal half of this: it validates hrefs between our
// own pages against the built site. Nothing checked the outbound half, and it
// rots differently — not because we renamed a page, but because a bucket key
// moved, a release asset got a version in its name, or a vendor reorganized
// their docs. The first sweep found eleven, including a DOI one character wrong
// and two reference genomes the config guide told readers to load.
//
// NOT a PR gate, for the same reason the figure sweep isn't: nearly every URL
// here is somebody else's host, so a required check built on them fails on
// their outage rather than on the change under review. `.github/workflows/
// links.yml` runs it weekly, and `workflow_dispatch` runs it on demand.
//
// A non-2xx is not automatically a dead link, which is most of the work here:
//
//   * publishers (doi.org's targets, sciencedirect, npmjs) answer a scripted
//     request with 403 and a browser with 200. Reported, never fatal;
//   * an S3 prefix that is not an object 404s, and plenty of URLs we write are
//     prefixes on purpose: a zarr store root, an rGFA stem an adapter extends
//     with `.segs.bed.gz`, the `$BASE` a tutorial appends a script name to.
//     Those live in PREFIXES below, checked by probing a real child instead;
//   * a placeholder (`https://yourhost/file.bam`) is not a URL at all.
//
// Run: `pnpm check-external-links`, or `--json` for the raw table.
import { execFile as execFileCb, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'

import { repoRoot } from './paths.ts'

const execFile = promisify(execFileCb)

const CONCURRENCY = 8
const TIMEOUT_MS = 30_000
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Not a URL: a stand-in the reader is meant to replace.
const PLACEHOLDER =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org)|yourhost|yourserver|yourremote|myhost|mybucket|myuniversity|myinstitution|somesite|sample\.com|my-plugin|<|\{|\$|…|%s|MYSITE|host\/jbrowse/i

// A URL we write that is a prefix rather than a fetchable object, mapped to a
// child that must exist. Probing the child is the real check: it catches the
// bucket key going away, which is the failure the bare prefix cannot see.
const PREFIXES: [string, string][] = [
  // rGFA stems — RgfaTabixAdapter appends .segs.bed.gz / .links.bed.gz
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb', '.segs.bed.gz'],
  ['https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38', '.segs.bed.gz'],
  // zarr store roots — the adapter reads objects inside
  ['https://jbrowse.org/demos/tcga/tcga_brca_cnv.zarr', '/zarr.json'],
  ['https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr', '/zarr.json'],
  // a tutorial's $BASE, appended with a script name
  [
    'https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts',
    '/build_dog10k_size_fst.sh',
  ],
]

// Endpoints that answer a GET with an error by design: an OAuth token endpoint
// takes POST, an API base has no resource at the root, a bucket prefix serving
// real objects has no listing. Each is here because the thing it fronts was
// verified to work, not because the code was noisy.
const EXPECTED_NON_2XX = new Set([
  'https://api.dropbox.com/oauth2/token',
  'https://share.jbrowse.org/api/v1/',
  'https://jbrowse.org/plugins/',
  'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/',
  'https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma',
])

// Hosts that serve a scripted request an error and a browser a page. Their
// results are reported but never fail the run.
const BOT_BLOCKED = /^(4\d\d)$/

interface Probe {
  url: string
  code: string
  where: string[]
}

function collectUrls() {
  const files = execFileSync(
    'git',
    [
      'ls-files',
      '--',
      '*.md',
      '*.json',
      '*.sh',
      '*.ts',
      '*.tsx',
      '*.py',
      '*.astro',
    ],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 128e6 },
  )
    .trim()
    .split('\n')
    .filter(f => !/node_modules|-lock\.(json|yaml)$|\/dist\//.test(f))

  const hits = new Map<string, string[]>()
  for (const rel of files) {
    let text: string
    try {
      text = readFileSync(`${repoRoot}/${rel}`, 'utf8')
    } catch {
      continue
    }
    if (!text.includes('http')) {
      continue
    }
    text.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/https?:\/\/[^\s"'`)<>\]\\,]+/g)) {
        const url = m[0].replace(/[.,;:]+$/, '')
        if (PLACEHOLDER.test(url)) {
          continue
        }
        const at = `${rel}:${i + 1}`
        const prev = hits.get(url)
        if (prev) {
          prev.push(at)
        } else {
          hits.set(url, [at])
        }
      }
    })
  }
  return hits
}

// A range request rather than a GET: many of these are multi-gigabyte data
// files, and one byte proves the key is there just as well.
async function status(url: string): Promise<string> {
  const args = (head: boolean) => [
    '-s',
    '-L',
    '-A',
    UA,
    '--max-time',
    String(TIMEOUT_MS / 1000),
    '-o',
    '/dev/null',
    '-w',
    '%{http_code}',
    ...(head ? ['-I'] : ['-r', '0-0']),
    url,
  ]
  // execFile, not execFileSync: the sync form blocks the event loop, which
  // would quietly serialize the worker pool below and turn a six-minute sweep
  // into an hour of one-at-a-time requests.
  const run = async (head: boolean) => {
    try {
      const { stdout } = await execFile('curl', args(head))
      return stdout.trim()
    } catch {
      return '000'
    }
  }
  const code = await run(false)
  // A server that refuses a range or throttles a burst may still answer HEAD.
  return ['000', '403', '405', '429', '501'].includes(code)
    ? await run(true)
    : code
}

async function probeAll(urls: string[], hits: Map<string, string[]>) {
  const out: Probe[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < urls.length) {
        const url = urls[next++]!
        out.push({ url, code: await status(url), where: hits.get(url) ?? [] })
      }
    }),
  )
  return out
}

const hits = collectUrls()
const prefixMap = new Map(PREFIXES)
// Probe the child in place of the prefix, and report it under the prefix's name
// so the finding points at what is actually written in the file.
const targets = [...hits.keys()].map(u =>
  prefixMap.has(u) ? `${u}${prefixMap.get(u)}` : u,
)
const asWritten = new Map(
  [...hits.keys()].map((u, i) => [targets[i]!, u] as const),
)
for (const [child, written] of asWritten) {
  if (child !== written) {
    hits.set(child, hits.get(written)!)
  }
}

console.log(`probing ${targets.length} external urls`)
const results = await probeAll(targets, hits)
const label = (p: Probe) => asWritten.get(p.url) ?? p.url

const dead = results.filter(
  p =>
    /^(400|404|410)$/.test(p.code) &&
    !EXPECTED_NON_2XX.has(label(p)) &&
    !EXPECTED_NON_2XX.has(p.url),
)
const blocked = results.filter(
  p => BOT_BLOCKED.test(p.code) && !dead.includes(p),
)
const unreachable = results.filter(p => p.code === '000')

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2))
}

for (const p of unreachable) {
  console.log(`unreachable  ${label(p)}\n             ${p.where.join(' ')}`)
}
console.log(
  `\n${results.length - dead.length - blocked.length - unreachable.length} ok, ` +
    `${blocked.length} answered a script an error (browsers get the page), ` +
    `${unreachable.length} unreachable, ${dead.length} dead`,
)

if (dead.length) {
  console.log('\nDead links:\n')
  for (const p of dead) {
    console.log(`  ${p.code}  ${label(p)}`)
    for (const w of p.where) {
      console.log(`        ${w}`)
    }
  }
  process.exit(1)
}
