import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { assembleRScript } from '@jbrowse/plugin-linear-genome-view'

import { geneFragment } from './exportRCode.ts'

// Only run when R + rtracklayer are installed (skipped in CI). Executes the
// *real* generated script so a codegen change that emits invalid or
// non-running R fails the test.
function rWithRtracklayer() {
  const probe = spawnSync(
    'Rscript',
    ['-e', 'cat(requireNamespace("rtracklayer", quietly = TRUE))'],
    { encoding: 'utf8' },
  )
  return probe.status === 0 && probe.stdout.trim() === 'TRUE'
}

const maybe = rWithRtracklayer() ? test : test.skip

function runsToFigure(uri: string, format: 'gff' | 'bed') {
  const fragment = geneFragment({
    trackId: 'genes',
    trackName: 'Volvox genes',
    uri: resolve(process.cwd(), uri),
    format,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 1000, end: 9000 }, [
    fragment,
  ])
  const dir = mkdtempSync(join(tmpdir(), `jb-rexport-${format}-`))
  const scriptPath = join(dir, 'view.R')
  writeFileSync(scriptPath, script)
  execFileSync('Rscript', [scriptPath], { cwd: dir, stdio: 'pipe' })
  return existsSync(join(dir, 'jbrowse_region.png'))
}

maybe(
  'generated GFF3 gene-track R script runs and produces a figure',
  () => {
    expect(runsToFigure('test_data/volvox/volvox.sort.gff3.gz', 'gff')).toBe(
      true,
    )
  },
  60000,
)

maybe(
  'generated BED12 gene-track R script runs and produces a figure',
  () => {
    expect(runsToFigure('test_data/volvox/volvox-bed12.bed.gz', 'bed')).toBe(
      true,
    )
  },
  60000,
)

// Which transcript the representative-transcript mode keeps. `rankIsoforms`
// ranks a CURATED TAG the annotation carries above every measurement of an
// isoform — it is the choice a human made, and for a gene whose longest protein
// is a minor variant it is the only thing that gets that gene right — and
// `collapse_isoforms` used to rank on protein length alone, so on any NCBI or
// GENCODE annotation the R panel drew a different transcript than the browser
// beside it.
//
// `volvox.canonical_tags.gff3` is built to discriminate: four genes covering
// NCBI's `tag=MANE Select`, GENCODE's comma list with `MANE_Select` inside it,
// an `Ensembl_canonical` with no MANE beside it, and one tagged nothing — and
// every tagged transcript is the SHORTER protein, so a collapse that keeps it
// can only have read the tag.
const CANONICAL_TAGS = [
  'MANE Select',
  'MANE_Select',
  'RefSeq Select',
  'Ensembl_canonical',
]

function keptTranscripts(canonicalTags: string[]) {
  const fragment = geneFragment({
    trackId: 'genes',
    trackName: 'Canonical tags',
    uri: resolve(process.cwd(), 'test_data/volvox/volvox.canonical_tags.gff3'),
    format: 'gff',
    collapseIsoforms: ['mRNA'],
    canonicalField: 'tag',
    canonicalTags,
  })
  const script = assembleRScript({ refName: 'ctgA', start: 0, end: 50000 }, [
    fragment,
  ])
  const dir = mkdtempSync(join(tmpdir(), 'jb-rexport-canon-'))
  const scriptPath = join(dir, 'probe.R')
  // the script's own helpers, then its setup — the path, the filter list, the
  // isoform types and the tag list the panel reads — and then the panel's own
  // data expression, so what this measures is the frame the figure is drawn
  // from rather than a restatement of it
  writeFileSync(
    scriptPath,
    `${script.split('# Data sources')[0]!}
${fragment.setup}
regions <- data.frame(chrom = "ctgA", start = 0, end = 50000, offset = 0)
d <- ${fragment.dataExpr}
d <- d[tolower(d$type) == "mrna", , drop = FALSE]
# no tag list asked for means read_gff never read the attribute, which is the
# point of the control run rather than an accident to paper over
tg <- if (is.null(d$tag)) rep("-", nrow(d)) else ifelse(is.na(d$tag), "-", d$tag)
cat(paste(d$name, tg, sep = "\\t"), sep = "\\n")
`,
  )
  const out = execFileSync('Rscript', [scriptPath], {
    cwd: dir,
    encoding: 'utf8',
  })
  return out
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(l => {
      const [name, tag] = l.split('\t')
      return { name: name!, tag: tag! }
    })
}

maybe(
  'the representative transcript is the tagged one, not the longest protein',
  () => {
    const tagged = keptTranscripts(CANONICAL_TAGS)
    const byLength = keptTranscripts([])
    expect(tagged).toHaveLength(4)
    expect(byLength).toHaveLength(4)

    // three of the four genes carry a tag, and each one's survivor carries it —
    // read off the frame rather than named here, so the assertion cannot drift
    // from the fixture
    const wanted = new Set(CANONICAL_TAGS.map(t => t.toLowerCase()))
    const carriesTag = (t: { tag: string }) =>
      t.tag.split(',').some(v => wanted.has(v.trim().toLowerCase()))
    expect(tagged.filter(carriesTag)).toHaveLength(3)

    // and the tag is what did it: ranking on protein length alone keeps a
    // different transcript for every one of those three, and none of them is
    // tagged
    const swapped = tagged.filter(t => !byLength.some(b => b.name === t.name))
    expect(swapped).toHaveLength(3)
    expect(swapped.every(carriesTag)).toBe(true)
  },
  60000,
)
