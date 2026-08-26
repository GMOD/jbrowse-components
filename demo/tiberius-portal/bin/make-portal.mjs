#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
// Build a static gene-model review portal from a prediction GFF, a reference
// annotation and a genome.
//
// Everything it emits is static: the data, the config, the pictures, the page,
// and (with --with-app) JBrowse itself. Copy the directory to any web server.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  absoluteLink,
  captureAll,
  relativeLink,
  sessionFor,
} from '../lib/capture.mjs'
import { classify, CLASSES } from '../lib/classify.mjs'
import {
  buildConfig,
  checkTools,
  fetchRegions,
  isUrl,
  prepareBam,
  prepareFasta,
  prepareGff,
} from '../lib/prepare.mjs'
import { serveStatic } from '../lib/serve.mjs'

const HERE = import.meta.dirname
const DEFAULT_INSTANCE = 'https://jbrowse.org/code/jb2/latest/'
const CLASS_ORDER = [
  'merge',
  'structure-conflict',
  'novel-locus',
  'novel-coding',
]

function usage() {
  console.log(`
make-portal — a static review portal for gene predictions

REQUIRED
  --prediction <gff>     the predicted models (Tiberius, AUGUSTUS, BRAKER, ...)
  --fasta <fa|fa.gz>     the genome the prediction was made against
  --out <dir>            directory to write (created, must not be a live site)

STRONGLY RECOMMENDED
  --reference <gff>      a reference annotation to compare against. Without it
                         every model lands in one bucket and there is nothing
                         to triage.

OPTIONAL
  --rnaseq <bam>         evidence track, repeatable. Appears in every capture
                         and every live link.
  --aliases <file|url>   a refName alias table (UCSC style, two columns). Needed
                         whenever the annotations say chr22 and the FASTA says 22,
                         which JBrowse reports as "unknown reference sequence name".
  --prediction-name <s>  track label for the prediction (default: its filename)
  --reference-name <s>   track label for the reference (default: its filename)
  --assembly <name>      assembly name in the config (default: the fasta's basename)
  --region <refName>     restrict the scan to one contig, repeatable
  --max <n>              candidates kept per class (default 12)
  --title <text>         page heading
  --with-app             run \`jbrowse create\` so the portal ships its own copy
                         of JBrowse and needs no internet at all
  --instance <url>       drive/link a hosted JBrowse instead (default ${DEFAULT_INSTANCE})
  --no-capture           skip the screenshots; links still work
  --inline-images        embed the captures in index.html, so the portal is one
                         file. Needs --region with remote inputs.
  --public-config <url>  where config.json will be published. Captures still run
                         against the local copy; only the links use this, which
                         is what lets a single-file portal be deployed on its own.
  --width/--height <px>  capture size (default 1400x400)
  --scale <n>            capture device pixel ratio (default 2)

EXAMPLE
  node bin/make-portal.mjs \\
    --prediction tiberius.gff3 --reference gencode.gff3 --fasta genome.fa \\
    --rnaseq rnaseq.bam --assembly hg38 --region chr22 \\
    --with-app --out ./portal
`)
}

function parseArgs(argv) {
  const o = {
    rnaseq: [],
    region: [],
    max: 12,
    width: 1400,
    height: 400,
    scale: 2,
    capture: true,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--prediction') {
      o.prediction = next()
    } else if (a === '--reference') {
      o.reference = next()
    } else if (a === '--fasta') {
      o.fasta = next()
    } else if (a === '--rnaseq') {
      o.rnaseq.push(next())
    } else if (a === '--assembly') {
      o.assembly = next()
    } else if (a === '--region') {
      o.region.push(next())
    } else if (a === '--out') {
      o.out = next()
    } else if (a === '--max') {
      o.max = +next()
    } else if (a === '--title') {
      o.title = next()
    } else if (a === '--instance') {
      o.instance = next()
    } else if (a === '--with-app') {
      o.withApp = true
    } else if (a === '--no-capture') {
      o.capture = false
    } else if (a === '--inline-images') {
      o.inlineImages = true
    } else if (a === '--public-config') {
      o.publicConfig = next()
    } else if (a === '--aliases') {
      o.aliases = next()
    } else if (a === '--prediction-name') {
      o.predictionName = next()
    } else if (a === '--reference-name') {
      o.referenceName = next()
    } else if (a === '--width') {
      o.width = +next()
    } else if (a === '--height') {
      o.height = +next()
    } else if (a === '--scale') {
      o.scale = +next()
    } else if (a === '--help' || a === '-h') {
      o.help = true
    } else {
      throw new Error(`unknown flag ${a}`)
    }
  }
  return o
}

const opts = parseArgs(process.argv.slice(2))
if (opts.help || !opts.prediction || !opts.fasta || !opts.out) {
  usage()
  process.exit(opts.help ? 0 : 1)
}
for (const f of [
  opts.prediction,
  opts.reference,
  opts.fasta,
  opts.aliases,
  ...opts.rnaseq,
].filter(Boolean)) {
  if (isUrl(f)) {
    continue
  }
  if (!fs.existsSync(f)) {
    console.error(`no such file: ${f}`)
    process.exit(1)
  }
}

const out = path.resolve(opts.out)
const dataDir = path.join(out, 'data')
const imgDir = path.join(out, 'img')
const assembly =
  opts.assembly ||
  path.basename(opts.fasta).replace(/\.(fa|fasta)(\.gz)?$/i, '') ||
  'genome'
const portalId = `${assembly}-${path.basename(opts.prediction).replaceAll(/\W+/g, '_')}`

function copyAlongside(input, dir) {
  fs.mkdirSync(dir, { recursive: true })
  const base = path.basename(input)
  fs.copyFileSync(input, path.join(dir, base))
  return base
}

console.log(`→ ${out}`)
checkTools({ needsBam: opts.rnaseq.length > 0 })
fs.mkdirSync(dataDir, { recursive: true })

console.log('preparing data')
const fastaRef = prepareFasta(opts.fasta, dataDir, assembly)
const predictionRef = prepareGff(opts.prediction, dataDir, 'prediction')
const referenceRef = opts.reference
  ? prepareGff(opts.reference, dataDir, 'reference')
  : null
const rnaRefs = opts.rnaseq.map(b => prepareBam(b, dataDir))

const aliasesRef = opts.aliases
  ? isUrl(opts.aliases)
    ? opts.aliases
    : copyAlongside(opts.aliases, dataDir)
  : null

const config = buildConfig({
  assembly,
  fastaRef,
  aliasesRef,
  predictionRef,
  referenceRef,
  rnaRefs,
  predictionName:
    opts.predictionName ||
    path.basename(opts.prediction).replace(/\.gff3?(\.gz)?$/i, ''),
  referenceName:
    opts.referenceName ||
    (opts.reference
      ? path.basename(opts.reference).replace(/\.gff3?(\.gz)?$/i, '')
      : null),
})
fs.writeFileSync(path.join(out, 'config.json'), JSON.stringify(config, null, 2))
const trackIds = config.tracks.map(t => t.trackId)

console.log('classifying')
if (!opts.reference) {
  console.log('  no --reference given: every model is reported unclassified')
}
const refNames = opts.region.length ? new Set(opts.region) : null

// The config can name a remote GFF directly, but the classifier has to read
// one. Pull down just the regions asked for rather than the whole annotation.
function readable(input, name) {
  if (!isUrl(input)) {
    return input
  }
  if (!opts.region.length) {
    console.error(
      `--${name} is a URL, so --region is required: the classifier reads the file and will not fetch a whole remote annotation.`,
    )
    process.exit(1)
  }
  const local = path.join(scratch, `${name}.gff`)
  console.log(`  fetching ${opts.region.join(', ')} from ${input}`)
  return fetchRegions(input, opts.region, local)
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'make-portal-'))
const { rows, tally, total } = opts.reference
  ? classify({
      predictionFile: readable(opts.prediction, 'prediction'),
      referenceFile: readable(opts.reference, 'reference'),
      refNames,
    })
  : { rows: [], tally: {}, total: 0 }
fs.rmSync(scratch, { recursive: true, force: true })

const agrees = tally.agrees || 0
const flagged = total - agrees
console.log(`  ${total} models · ${agrees} agree · ${flagged} flagged`)
for (const k of CLASS_ORDER) {
  if (tally[k]) {
    console.log(`    ${CLASSES[k].label}: ${tally[k]}`)
  }
}

const candidates = CLASS_ORDER.flatMap(cls =>
  rows
    .filter(r => r.cls === cls)
    .sort((a, b) => b.nExons - a.nExons || b.span - a.span)
    .slice(0, opts.max),
)
console.log(
  `  ${candidates.length} candidates selected (max ${opts.max} per class)`,
)

if (opts.withApp) {
  const appDir = path.join(out, 'jbrowse')
  if (fs.existsSync(path.join(appDir, 'index.html'))) {
    console.log('bundling JBrowse — already present, skipping')
  } else {
    console.log('bundling JBrowse (jbrowse create)')
    execFileSync('jbrowse', ['create', appDir], { stdio: 'inherit' })
  }
}

let captured = []
if (opts.capture && candidates.length) {
  console.log(`capturing ${candidates.length} views`)
  const server = await serveStatic(out)
  const instance = opts.withApp
    ? `${server.url}/jbrowse/`
    : opts.instance || DEFAULT_INSTANCE
  const configUrl = `${server.url}/config.json`
  if (!opts.withApp) {
    console.log(`  driving ${instance} against ${configUrl}`)
    console.log(
      '  a hosted instance cannot reach a local config; use --with-app for local data',
    )
  }
  try {
    captured = await captureAll({
      candidates,
      trackIds,
      assembly,
      instance,
      configUrl,
      outDir: imgDir,
      captureBin: path.resolve(
        HERE,
        '../../../products/jbrowse-capture/src/bin.ts',
      ),
      width: opts.width,
      height: opts.height,
      scale: opts.scale,
      settle: 900,
      timeout: 90000,
      onProgress: (c, ok, note) => {
        console.log(
          `  ${ok ? 'ok  ' : 'FAIL'} ${c.id} ${c.refName}:${c.start + 1}-${c.end}${ok ? '' : ` — ${note}`}`,
        )
      },
    })
  } finally {
    await server.close()
  }
  const failed = captured.filter(c => !c.ok).length
  if (failed) {
    console.log(`  ${failed} capture(s) failed; their cards show the link only`)
  }
}

const imgFor = id => {
  const hit = captured.find(c => c.id === id)
  if (!hit || !hit.ok) {
    return null
  }
  if (!opts.inlineImages) {
    return `img/${hit.file}`
  }
  const bytes = fs.readFileSync(path.join(imgDir, hit.file))
  return `data:image/png;base64,${bytes.toString('base64')}`
}

const cards = candidates.map(c => {
  const { loc, session } = sessionFor(c, trackIds, assembly)
  return {
    id: c.id,
    cls: c.cls,
    loc,
    refName: c.refName,
    nExons: c.nExons,
    strand: c.strand,
    spanKb: Math.round(c.span / 100) / 10,
    genes: c.genes,
    gapBp: c.gapBp,
    img: imgFor(c.id),
    url: opts.publicConfig
      ? absoluteLink(
          session,
          opts.instance || DEFAULT_INSTANCE,
          opts.publicConfig,
        )
      : opts.withApp
        ? relativeLink(session)
        : absoluteLink(
            session,
            opts.instance || DEFAULT_INSTANCE,
            'config.json',
          ),
  }
})

const title = opts.title || `${assembly} gene models that need a human`
const data = {
  portalId,
  title,
  eyebrow: [
    assembly,
    opts.region.join(', ') || 'all contigs',
    'prediction vs reference',
  ]
    .filter(Boolean)
    .join(' · '),
  lede:
    `The prediction has <strong>${total}</strong> gene models here. ` +
    `<strong>${agrees}</strong> share splice junctions with a reference gene and need no attention. ` +
    `The other <strong>${flagged}</strong> disagree in one of four ways. ${
      cards.length < flagged
        ? `The ${opts.max} with the most exons in each class are below, `
        : 'All of them are below, '
    }with the evidence staged the same way every time.`,
  footer:
    '<div><b>How this page was built.</b> Every picture is a JBrowse view captured headlessly ' +
    'at that locus, and every <b>Open in JBrowse</b> link reopens the same view live. The candidate ' +
    'list comes from an exon-level comparison of the prediction against the reference annotation.</div>' +
    '<div>The triage is the browser’s half. The edit belongs in an annotation editor — ' +
    '<b>Split into two models</b> is not a viewer action.</div>' +
    '<div>Verdicts are stored in this browser only. <b>Export decisions</b> writes them out as TSV.</div>',
  total,
  agrees,
  flagged,
  tally,
  classes: CLASSES,
  classOrder: CLASS_ORDER,
  cards,
}

const template = fs.readFileSync(
  path.join(HERE, '../lib/template.html'),
  'utf8',
)
fs.writeFileSync(
  path.join(out, 'index.html'),
  template
    .replace('__TITLE__', title.replaceAll(/[<&]/g, ''))
    // `</script>` inside the JSON would close the tag it sits in
    .replace('__DATA__', JSON.stringify(data).replaceAll('</', '<\\/')),
)

console.log(`\nportal written to ${out}`)
console.log(
  `  ${cards.length} cards, ${captured.filter(c => c.ok).length} captures`,
)
console.log(`\n  npx serve ${path.relative(process.cwd(), out) || '.'}`)
if (!opts.withApp) {
  console.log(
    '  note: without --with-app the links point at a hosted JBrowse, which cannot',
  )
  console.log(
    '        read a config.json on your laptop. Publish the directory, or rebuild',
  )
  console.log('        with --with-app for a portal that is self-contained.')
}
