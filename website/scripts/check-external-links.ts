// Probes every external URL written anywhere in the repo — docs prose, tutorial
// reproduce scripts, demo and test configs, screenshot specs — and fails on the
// ones that are gone. A demo config's RELATIVE uris are in that too, resolved
// against the directory the demo is served from; `demoDataUrls` below says why
// they need a pass of their own.
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
// And the inverse, which is the one this checker was blind to: a 2xx is not
// automatically a live page. A static site serves a route it chose not to build
// as a `<meta refresh>` stub with a 200 on it. See `softRedirectTarget` below.
//
// Run: `pnpm check-external-links`, or `--json` for the raw table.
import { execFile as execFileCb, execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { promisify } from 'node:util'

import { repoRoot } from './paths.ts'

const execFile = promisify(execFileCb)

const CONCURRENCY = 8
const TIMEOUT_MS = 30_000
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// Not a URL: a stand-in the reader is meant to replace.
const PLACEHOLDER =
  /localhost|127\.0\.0\.1|0\.0\.0\.0|example\.(com|org)|yourhost|yourserver|yourremote|myhost|mybucket|myuniversity|myinstitution|somesite|sample\.com|my-plugin|your-|yoursite|<|\{|\$|…|%s|MYSITE|host\/jbrowse/i

// An IRI, not a link. RDF identifiers are spelled as URLs and are not expected
// to resolve to anything — `purl.obolibrary.org/obo/so#` names the Sequence
// Ontology in the SPARQL demo's data, it does not fetch it.
const IRI_NAMESPACE =
  /^https?:\/\/(identifiers\.org|purl\.obolibrary\.org|semanticscience\.org|www\.w3\.org|schema\.org)\//

// A test's fake URL is not a link either — checkPlugins.test.ts asserts that
// `https://evil.com/...` is rejected, and half the UCSC hub tests point at
// `x.org`. Fixtures under a CLI's own test/data are the same thing in JSON.
const IS_TEST = /\.test\.[jt]sx?$|__mocks__|\/test\/data\//

// A URL we write that is a prefix rather than a fetchable object, mapped to a
// child that must exist. Probing the child is the real check: it catches the
// bucket key going away, which is the failure the bare prefix cannot see.
const PREFIXES: [string, string][] = [
  // rGFA stems — RgfaTabixAdapter appends .segs.bed.gz / .links.bed.gz
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph', '.segs.bed.gz'],
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus', '.segs.bed.gz'],
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb', '.segs.bed.gz'],
  [
    'https://jbrowse.org/demos/ecoli_pangenome/ecoli_pggb.tier50',
    '.segs.bed.gz',
  ],
  ['https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38', '.segs.bed.gz'],
  [
    'https://jbrowse.org/demos/hprc/hprc-v2.0-mc-grch38.tier10000',
    '.segs.bed.gz',
  ],
  // zarr store roots — the adapter reads objects inside
  ['https://jbrowse.org/demos/tcga/tcga_brca_cnv.zarr', '/zarr.json'],
  ['https://jbrowse.org/demos/1000g/qm2_cn_1kb.zarr', '/zarr.json'],
  ['https://jbrowse.org/demos/1000g/qm2_cn_wg_10kb.zarr', '/zarr.json'],
  ['https://jbrowse.org/demos/scrna_pbmc5k/percell.zarr', '/zarr.json'],
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_minigraph', '.segs.bed.gz'],
  ['https://jbrowse.org/demos/ecoli_pangenome/ecoli_cactus', '.segs.bed.gz'],
  // a demo's asset directory, named as a base a spec or script appends to
  ['https://jbrowse.org/demos/cancer_sv', '/config.json'],
  ['https://jbrowse.org/demos/cancer_sv/', 'config.json'],
  ['https://jbrowse.org/demos/dtu/', 'config.json'],
  // build_ag1000g_ld.sh's $DERIVED, which it appends each intermediate to
  ['https://jbrowse.org/demos/ag1000g', '/samples.meta.txt'],
  // the desktop updater's release-page base, built up with a version
  ['https://github.com/GMOD/jbrowse-components/releases/tag/v', '3.0.0'],
  ['https://jbrowse.org/demos/tcga', '/tcga_brca_clinical.tsv'],
  ['https://jbrowse.org/demos/popgen', '/lct_1kg38_chr2_6pop.vcf.gz'],
  ['https://jbrowse.org/demos/gwas', '/plink.ld.tab.gz'],
  ['https://jbrowse.org/demos/scrna_pbmc5k', '/percell.zarr/zarr.json'],
  ['https://jbrowse.org/genomes/potato/', 'config.json'],
  [
    'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv',
    '/PUR/HG00553.qm2.CN.1k.bw',
  ],
  [
    'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/',
    'PUR/HG00553.qm2.CN.1k.bw',
  ],
  [
    'https://jbrowse.org/genomes/GRCh38/1000g/kidd_lab_cnv/PUR',
    '/HG00553.qm2.CN.1k.bw',
  ],
  // the deployed app's bundled test data, which examples and the quickstart
  // script point at by directory
  ['https://jbrowse.org/code/jb2/main/test_data/volvox', '/volvox.fa'],
  ['https://jbrowse.org/code/jb2/main/test_data/volvox/', 'volvox.fa'],
  ['https://jbrowse.org/code/jb2/latest/test_data/volvox', '/volvox.fa'],
  // the hosted reference the config guide and the embed examples load
  ['https://jbrowse.org/genomes/GRCh38/fasta/', 'GRCh38.fa.gz'],
  // a tutorial's $BASE, appended with a script name
  [
    'https://raw.githubusercontent.com/GMOD/jbrowse-components/main/scripts',
    '/build_dog10k_size_fst.sh',
  ],
  // scan_mappability_qc.sh's $ONT_BASE. The bucket answers a bare prefix with
  // 404 rather than a listing, so only a key under it can say whether the
  // release is still there.
  [
    'https://s3.amazonaws.com/1000g-ont/PROCESSED_DATA',
    '/ALIGNED_TO_HG38/MINIMAP2_ALIGNED_BAMS/GM18501-ONT-hg38-R9-LSK110-guppy-sup-5mC.phased.bam',
  ],
  // hg002_haplotypes.ts's GENE_TRACK_BASE, extended per haplotype
  [
    'https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/HG002/assemblies/annotation/JHULiftoff/v0.6/hg002v1.1',
    '.MAT.loff.v0.6.gff.gz',
  ],
]

// Endpoints that answer a GET with an error by design: an OAuth token endpoint
// takes POST, an API base has no resource at the root, a bucket prefix serving
// real objects has no listing. Each is here because the thing it fronts was
// verified to work, not because the code was noisy.
const EXPECTED_NON_2XX = new Set([
  // POST endpoints, and API bases a script appends a path or query to
  'https://api.dropbox.com/oauth2/token',
  'https://api.dropboxapi.com/2/sharing/get_shared_link_metadata',
  'https://api.gdc.cancer.gov',
  'https://api.genome.ucsc.edu/getData/sequence',
  'https://api.jbrowse.org/ucsc/v1/blat',
  'https://api.jbrowse.org/ucsc/v1/ispcr',
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi',
  'https://rest.ensembl.org/lookup/symbol/homo_sapiens',
  'https://share.jbrowse.org/api/v1/',
  'https://www.ebi.ac.uk/rdf/services/sparql',
  'https://genenetwork.org/api/v_pre1/mapping?db=BXDPublish&method=gemma',
  // bucket prefixes a script builds object keys under: the objects are there,
  // the prefix is not an object
  'https://encode-public.s3.amazonaws.com/2021/10/28',
  'https://ont-open-data.s3.amazonaws.com/colo829_2024.03',
  'https://pan-ukb-us-east-1.s3.amazonaws.com/sumstats_flat_files',
  'https://s3-us-west-2.amazonaws.com/human-pangenomics/pangenomes/freeze/release2',
  'https://s3.amazonaws.com/genomeark/species',
  'https://sra-pub-run-odp.s3.amazonaws.com/sra',
  'https://ftp.sra.ebi.ac.uk/vol1/fastq/DRR029/DRR029742/DRR029742',
  'https://raw.githubusercontent.com/rrlove/compkaryo/master/compkaryo/targets',
  // our own bucket, where a listing is denied but the objects under it serve.
  // `hubs/genark/` is not even written as a link: it is the head of the GenArk
  // url template in the agent docs, left behind when the extractor stops at the
  // `<GCA|GCF>` placeholder that follows it.
  'https://jbrowse.org/plugins/',
  'https://jbrowse.org/hubs/genark/',
  // written as an illustration of a URL shape rather than as a link: somewhere
  // to host demo files, the prefix a prerelease uploads to
  'https://jbrowse.org/demos/arabidopsis/',
  'https://jbrowse.org/code/jb2/v5.0.0-beta.1/',
  'https://jbrowse.org/ucsc/',
  // an external site that reorganized, kept as the provenance note for a demo
  // track whose data we mirror
  'http://bioinformatics.uni-muenster.de/share/NanoPipe_test_data/?lang=en',
  // a changelog credit for a GitHub account that no longer exists: history,
  // not a link to maintain
  'https://github.com/carolinebridge-oicr',
  // deliberately absent: the example is about what a failed track fetch looks
  // like, so a 404 is the point of it
  'https://jbrowse.org/code/jb2/main/test_data/volvox/does-not-exist.bw',
  'https://jbrowse.org/genomes/volvox/does-not-exist.2bit',
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
    .filter(
      f =>
        !/node_modules|-lock\.(json|yaml)$|\/dist\//.test(f) &&
        !IS_TEST.test(f),
    )

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
        // `?config=https://host/x.json&session=…` is one match from the
        // inner URL on: the outer `?` was already consumed, so everything from
        // `&` on belongs to the outer query string, not to this URL.
        const raw = m[0].replace(/[.,;:]+$/, '')
        const url = raw.includes('?') ? raw : raw.split('&')[0]!
        // A hostname with no dot in it is a stand-in, not a host: `https://host`,
        // `http://`, and the `https://x}` a template literal leaves behind.
        let host: string
        try {
          host = new URL(url).hostname
        } catch {
          continue
        }
        if (
          !host.includes('.') ||
          PLACEHOLDER.test(url) ||
          IRI_NAMESPACE.test(url)
        ) {
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
  for (const [url, at] of demoDataUrls()) {
    const prev = hits.get(url)
    if (prev) {
      prev.push(at)
    } else {
      hits.set(url, [at])
    }
  }
  return hits
}

// The data files a demo config names, resolved against the directory the demo
// is served from.
//
// The scan above is a regex for `https?://`, so it sees a demo's absolute URLs
// and none of its relative ones — and a demo config writes relative by default,
// because deploy-demo.sh puts config.json in the same bucket prefix as the files
// beside it. That is 288 of the 357 uris under demos/, and nothing had ever
// fetched one. The gap is not theoretical: demos/orthofinder_{grasses,
// vertebrates} spent 2026-08-28 naming `.tbi` indexes that the gene-count
// rebuild had replaced with `.csi` and deleted from the bucket, and both demos
// served a broken gene track until someone opened one. check-demo-configs.ts
// could not see it either — it compares the repo copy against the live copy, so
// two files that agree with each other agree about a key that is gone.
//
// jbrowse.org/demos/<dir>/ is the mapping deploy-demo.sh writes and
// check-demo-configs.ts reads, so the directory name is the whole address.
function demoDataUrls(): [string, string][] {
  const demosDir = `${repoRoot}/demos`
  const out: [string, string][] = []
  for (const dir of readdirSync(demosDir, { withFileTypes: true })) {
    const rel = `demos/${dir.name}/config.json`
    if (!dir.isDirectory() || !existsSync(`${repoRoot}/${rel}`)) {
      continue
    }
    let config: unknown
    try {
      config = JSON.parse(readFileSync(`${repoRoot}/${rel}`, 'utf8'))
    } catch {
      continue
    }
    for (const uri of uriValues(config)) {
      // an absolute one is already in the map from the text scan above, with a
      // line number this pass cannot offer
      if (!/^https?:\/\//.test(uri) && !PLACEHOLDER.test(uri)) {
        out.push([`https://jbrowse.org/demos/${dir.name}/${uri}`, rel])
      }
    }
  }
  return out
}

// Every `uri` under a UriLocation, wherever the schema puts one: an adapter's
// own location, its index, a subadapter, a per-assembly entry in a list.
// Walking for the key rather than reading known slot names is what keeps this
// from going stale against a new adapter.
function uriValues(node: unknown): string[] {
  if (Array.isArray(node)) {
    return node.flatMap(uriValues)
  }
  if (node && typeof node === 'object') {
    const self = (node as { uri?: unknown }).uri
    return [
      ...(typeof self === 'string' ? [self] : []),
      ...Object.values(node).flatMap(uriValues),
    ]
  }
  return []
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
  if (['000', '403', '405', '429', '501'].includes(code)) {
    return run(true)
  }
  // Confirm a failure before reporting it. NCBI answers a burst of scripted
  // requests with 404s — the accession in the dog10k tutorial came back dead on
  // one run and 200 on the next — and a plain GET a moment later separates that
  // from a page that is actually gone. A real 404 fails twice.
  if (['400', '404', '410'].includes(code)) {
    await new Promise(res => setTimeout(res, 2000))
    return run(true)
  }
  return code
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

// A 200 that is a redirect stub rather than a page, which every check above
// reads as healthy. A static Astro build turns `Astro.redirect('/')` into a
// `<meta http-equiv="refresh">` document served with a normal 200, so a link to
// a route the build decided not to publish resolves, scores ok, and lands the
// reader somewhere else a couple of seconds later.
//
// genomes.jbrowse.org is where this bites, because its routes are gated by
// feature flags that live in a different repo (~/src/jb2hubs,
// `website/src/config/features.ts`): a page can stop being published with
// nothing changing here and nothing failing. `/synteny` was staging-only while
// the synteny tutorial linked to it as the site's pair index.
//
// Only for hosts we publish, only for page-shaped paths, and only over the first
// 2 KB — the rest of the sweep is full of multi-gigabyte data files that must
// not be fetched, and a redirect stub is a few hundred bytes.
const OUR_HOST = /(^|\.)jbrowse\.org$/
const META_REFRESH =
  /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url=([^"'\s>]+)/i

function isPageShaped(url: string) {
  try {
    const { hostname, pathname } = new URL(url)
    const last = pathname.split('/').filter(Boolean).at(-1) ?? ''
    return (
      OUR_HOST.test(hostname) && (!last.includes('.') || last.endsWith('.html'))
    )
  } catch {
    return false
  }
}

// The path a stub points at, or undefined when the response is a real page.
// Trailing slashes are normalized away: `/synteny` serving `/synteny/` is the
// host being tidy, not a route that went away.
async function softRedirectTarget(url: string) {
  let body: string
  try {
    const { stdout } = await execFile('curl', [
      '-s',
      '-L',
      '-A',
      UA,
      '--max-time',
      String(TIMEOUT_MS / 1000),
      '-r',
      '0-2047',
      url,
    ])
    body = stdout
  } catch {
    return undefined
  }
  const target = META_REFRESH.exec(body)?.[1]
  if (!target) {
    return undefined
  }
  const trim = (s: string) => s.replace(/\/+$/, '')
  try {
    const to = new URL(target, url)
    return trim(to.pathname) === trim(new URL(url).pathname)
      ? undefined
      : to.href
  } catch {
    return target
  }
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

// A link into our own repo at `main` that 404s, whose path is in the local
// HEAD, is not rot: it is a commit that has not been pushed yet. CI runs on the
// pushed tree and will see it; a developer running this locally wants to be
// told which docs are ahead of the remote, not that a file is missing.
function pendingPush(url: string) {
  const m =
    /raw\.githubusercontent\.com\/GMOD\/jbrowse-components\/[^/]+\/(.+)$/.exec(
      url,
    ) ?? /github\.com\/GMOD\/jbrowse-components\/blob\/[^/]+\/(.+)$/.exec(url)
  if (!m) {
    return false
  }
  try {
    execFileSync('git', ['cat-file', '-e', `HEAD:${m[1]}`], {
      cwd: repoRoot,
      stdio: 'ignore',
    })
    return true
  } catch {
    return false
  }
}

const dead = results.filter(
  p =>
    /^(400|404|410)$/.test(p.code) &&
    !EXPECTED_NON_2XX.has(label(p)) &&
    !EXPECTED_NON_2XX.has(p.url) &&
    !pendingPush(label(p)),
)
const pending = results.filter(
  p => /^(400|404|410)$/.test(p.code) && pendingPush(label(p)),
)
const blocked = results.filter(
  p => BOT_BLOCKED.test(p.code) && !dead.includes(p),
)
const unreachable = results.filter(p => p.code === '000')

// Second pass, over the handful of our-host page URLs that answered ok above.
const stubCandidates = results.filter(
  p => /^2\d\d$/.test(p.code) && isPageShaped(p.url),
)
const softRedirects: { probe: Probe; to: string }[] = []
{
  let next = 0
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < stubCandidates.length) {
        const probe = stubCandidates[next++]!
        const to = await softRedirectTarget(probe.url)
        if (to) {
          softRedirects.push({ probe, to })
        }
      }
    }),
  )
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2))
}

for (const p of unreachable) {
  console.log(`unreachable  ${label(p)}\n             ${p.where.join(' ')}`)
}
for (const p of pending) {
  console.log(
    `pending push  ${label(p)}\n              in HEAD, not on the remote yet: ${p.where.join(' ')}`,
  )
}
console.log(
  `\n${results.length - dead.length - blocked.length - unreachable.length - softRedirects.length} ok, ` +
    `${blocked.length} answered a script an error (browsers get the page), ` +
    `${unreachable.length} unreachable, ${dead.length} dead, ` +
    `${softRedirects.length} redirect stubs (checked ${stubCandidates.length} of our pages)`,
)

if (softRedirects.length) {
  console.log(
    '\nRedirect stubs — these answer 200 with a page that bounces elsewhere,\n' +
      'so the route is not published. On genomes.jbrowse.org check whether a\n' +
      'feature flag in ~/src/jb2hubs turned it off:\n',
  )
  for (const { probe, to } of softRedirects) {
    console.log(`  ${label(probe)}  ->  ${to}`)
    for (const w of probe.where) {
      console.log(`        ${w}`)
    }
  }
}

if (dead.length) {
  console.log('\nDead links:\n')
  for (const p of dead) {
    console.log(`  ${p.code}  ${label(p)}`)
    for (const w of p.where) {
      console.log(`        ${w}`)
    }
  }
}

if (dead.length || softRedirects.length) {
  process.exit(1)
}
