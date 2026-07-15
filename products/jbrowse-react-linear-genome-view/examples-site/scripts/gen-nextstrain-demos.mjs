// Regenerates the Nextstrain demo configs under src/examples from live
// Nextstrain (auspice v2) datasets. The bulk data (reference sequence and the
// per-position diversity track) is emitted as standard bioinformatics flatfiles
// hosted on jbrowse.org/demos, so the committed config JSON stays a few KB
// instead of megabytes of inlined data:
//
//   <slug>.fa / <slug>.fa.fai   reference sequence   -> IndexedFastaAdapter
//   <slug>_entropy.bw           diversity (entropy)  -> BigWigAdapter
//
// The small gene-annotation set (a handful of colored features per pathogen)
// stays inline in the config. The reference sequence is Nextstrain's own
// published `<name>_root-sequence.json` sidecar (the tree root, coordinate-
// matched to the dataset by construction); a few datasets don't publish that
// sidecar, so `ref` gives a fallback GenBank reference from the build repo.
// New pathogens: extend DATASETS below.
//
// The flatfiles are written to ./nextstrain-demos-data/<slug>/ (gitignored) for
// upload to s3://jbrowse.org/demos/nextstrain/<slug>/. Requires `samtools` and
// UCSC `bedGraphToBigWig` on PATH.
//
// Usage: node scripts/gen-nextstrain-demos.mjs
import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const exampleDir = join(scriptDir, '..', 'src', 'examples')
const dataDir = join(scriptDir, '..', 'nextstrain-demos-data')

const S3_BASE = 'https://jbrowse.org/demos/nextstrain'

// each entry becomes src/examples/<file>.json, consumed by a matching
// <name>.tsx / <slug>.astro page. `assembly` is the JBrowse assembly + refName;
// `slug` is the hosting subdir under s3://jbrowse.org/demos/nextstrain/. `url`
// is the auspice v2 dataset. `ref` is only needed when the dataset has no
// published root-sequence sidecar (zika, measles).
const DATASETS = [
  {
    file: 'nextstrain_covid',
    slug: 'covid',
    assembly: 'SARS-CoV-2',
    url: 'https://data.nextstrain.org/ncov_open_global_6m.json',
  },
  {
    file: 'nextstrain_zika',
    slug: 'zika',
    assembly: 'Zika',
    url: 'https://data.nextstrain.org/zika.json',
    ref: 'https://raw.githubusercontent.com/nextstrain/zika/main/phylogenetic/defaults/reference.gb',
    polyprotein: true,
    genomesSeqs:
      'https://data.nextstrain.org/files/workflows/zika/sequences.fasta.zst',
  },
  {
    file: 'nextstrain_ebola',
    slug: 'ebola',
    assembly: 'Ebola',
    url: 'https://data.nextstrain.org/ebola.json',
  },
  {
    file: 'nextstrain_measles',
    slug: 'measles',
    assembly: 'Measles',
    url: 'https://data.nextstrain.org/measles.json',
    ref: 'https://raw.githubusercontent.com/nextstrain/measles/main/phylogenetic/defaults/measles_reference_genome.gb',
    genomesSeqs:
      'https://data.nextstrain.org/files/workflows/measles/sequences.fasta.zst',
  },
  {
    file: 'nextstrain_rsv_a',
    slug: 'rsv-a',
    assembly: 'RSV-A',
    url: 'https://data.nextstrain.org/rsv_a_genome.json',
  },
]

// auspice's default color ramp; sampled evenly to color genes left-to-right
const COLOR_RAMP = [
  '#511EA8',
  '#4334BF',
  '#4041C7',
  '#3F50CC',
  '#3F5ED0',
  '#4066D0',
  '#4174CE',
  '#4784C7',
  '#4B8AC3',
  '#529AB6',
  '#59A4A9',
  '#63AC99',
  '#6DB388',
  '#7CB879',
  '#8BBB69',
  '#9ABE5C',
  '#A6BE4F',
  '#B1BD4D',
  '#BDBB48',
  '#C7B944',
  '#CFB541',
  '#D9AD3D',
  '#DFA43A',
  '#E29E39',
  '#E68E35',
  '#E67932',
  '#E4632E',
  '#DF4B29',
  '#DE3C26',
  '#DC2F24',
]

// pull the ORIGIN sequence out of a GenBank flatfile (base-count lines and
// whitespace stripped), uppercased
function gbSequence(gb) {
  const origin = gb.split(/^ORIGIN/m)[1]
  if (!origin) {
    throw new Error('reference GenBank has no ORIGIN sequence block')
  }
  return origin.replace(/[^A-Za-z]/g, '').toUpperCase()
}

function parseMut(m) {
  const mm = /^([A-Za-z-])(\d+)([A-Za-z-])$/.exec(m)
  return mm
    ? { from: mm[1].toUpperCase(), pos: +mm[2], to: mm[3].toUpperCase() }
    : undefined
}

const isBase = b => b === 'A' || b === 'C' || b === 'G' || b === 'T'

// reconstruct each tip's nucleotide at every variable position by walking
// root->tip, then Shannon entropy of the per-position base distribution.
function entropyFeatures(tree, refName) {
  const rootBase = {} // pos -> ancestral base (from-base of shallowest mutation)
  const overCounts = {} // pos -> { base: numTips carrying it via a path mutation }
  let totalTips = 0

  const dfs = (node, overrides) => {
    const applied = []
    const muts = node.branch_attrs?.mutations?.nuc || []
    for (const raw of muts) {
      const m = parseMut(raw)
      if (m) {
        if (!(m.pos in overrides) && !(m.pos in rootBase)) {
          rootBase[m.pos] = m.from
        }
        applied.push([m.pos, m.pos in overrides ? overrides[m.pos] : undefined])
        overrides[m.pos] = m.to
      }
    }
    const children = node.children || []
    if (children.length === 0) {
      totalTips++
      for (const posStr of Object.keys(overrides)) {
        const base = overrides[posStr]
        const bucket = overCounts[posStr] || (overCounts[posStr] = {})
        bucket[base] = (bucket[base] || 0) + 1
      }
    } else {
      for (const ch of children) {
        dfs(ch, overrides)
      }
    }
    for (let i = applied.length - 1; i >= 0; i--) {
      const [pos, prev] = applied[i]
      if (prev === undefined) {
        delete overrides[pos]
      } else {
        overrides[pos] = prev
      }
    }
  }
  dfs(tree, {})

  const positions = new Set([
    ...Object.keys(rootBase),
    ...Object.keys(overCounts),
  ])
  const features = []
  for (const posStr of positions) {
    const dist = {}
    let overridden = 0
    const bucket = overCounts[posStr] || {}
    for (const base of Object.keys(bucket)) {
      overridden += bucket[base]
      if (isBase(base)) {
        dist[base] = (dist[base] || 0) + bucket[base]
      }
    }
    const anc = rootBase[posStr]
    if (isBase(anc)) {
      dist[anc] = (dist[anc] || 0) + (totalTips - overridden)
    }
    const counts = Object.values(dist)
    const n = counts.reduce((a, b) => a + b, 0)
    if (n > 0) {
      let h = 0
      for (const c of counts) {
        const p = c / n
        h -= p * Math.log2(p)
      }
      if (h > 0) {
        const pos = +posStr
        features.push({
          refName,
          score: Math.round(h * 1000) / 1000,
          start: pos - 1,
          end: pos,
          uniqueId: String(pos),
        })
      }
    }
  }
  features.sort((a, b) => a.start - b.start)
  return features
}

// Reconstruct each tip's genotype by walking root->tip and recording, per tip,
// the nucleotide it carries at every mutated position (the accumulated overrides
// at the leaf); positions not overridden are the ancestral/reference base. This
// is the genotype table behind the Nextstrain tree, in genome coordinates.
function genotypeData(tree) {
  const rootBase = {} // pos -> ancestral base (shallowest mutation's from-base)
  const tips = [] // { name, meta, muts: { pos: base } }
  const overrides = {}
  const dfs = node => {
    const applied = []
    const muts = node.branch_attrs?.mutations?.nuc || []
    for (const raw of muts) {
      const m = parseMut(raw)
      if (m) {
        if (!(m.pos in overrides) && !(m.pos in rootBase)) {
          rootBase[m.pos] = m.from
        }
        applied.push([m.pos, overrides[m.pos]])
        overrides[m.pos] = m.to
      }
    }
    const children = node.children || []
    if (children.length === 0) {
      const na = node.node_attrs || {}
      tips.push({
        name: node.name,
        meta: {
          region: na.region?.value ?? '',
          country: na.country?.value ?? '',
          date: na.num_date?.value ? String(Math.floor(na.num_date.value)) : '',
        },
        muts: { ...overrides },
      })
    } else {
      for (const ch of children) {
        dfs(ch)
      }
    }
    for (let i = applied.length - 1; i >= 0; i--) {
      const [pos, prev] = applied[i]
      if (prev === undefined) {
        delete overrides[pos]
      } else {
        overrides[pos] = prev
      }
    }
  }
  dfs(tree)
  return { rootBase, tips }
}

const rampColor = (i, n) =>
  COLOR_RAMP[Math.round((i / Math.max(1, n - 1)) * (COLOR_RAMP.length - 1))]

function geneFeatures(annotations, refName, polyprotein) {
  const genes = Object.keys(annotations)
    .filter(g => g !== 'nuc')
    .map(name => ({ name, ...annotations[name] }))
    .sort((a, b) => a.start - b.start)

  // flaviviruses (Zika, dengue) translate one polyprotein that is cleaved into
  // mature peptides — the dataset's "genes" are those peptides, tiling one ORF.
  // Render them as subfeatures of a single polyprotein so the cleavage products
  // read as one unit, not a dozen independent genes.
  if (polyprotein) {
    const start = Math.min(...genes.map(g => g.start)) - 1
    const end = Math.max(...genes.map(g => g.end))
    return [
      {
        refName,
        name: 'polyprotein',
        type: 'mRNA',
        uniqueId: 'polyprotein',
        start,
        end,
        strand: 1,
        subfeatures: genes.map((g, i) => ({
          refName,
          name: g.name,
          type: 'mature_protein_region_of_CDS',
          uniqueId: i,
          start: g.start - 1,
          end: g.end,
          strand: g.strand === '-' ? -1 : 1,
          fill: rampColor(i, genes.length),
        })),
      },
    ]
  }

  return genes.map((g, i) => {
    const fill = rampColor(i, genes.length)
    const strand = g.strand === '-' ? -1 : 1
    // segment-only CDSs (e.g. measles V) carry no top-level start/end, so take
    // the parent bounds from the spliced segments
    const start = g.start ?? Math.min(...g.segments.map(s => s.start))
    const end = g.end ?? Math.max(...g.segments.map(s => s.end))
    const feature = {
      refName,
      name: g.name,
      uniqueId: i,
      start: start - 1,
      end,
      strand,
      fill,
    }
    if (g.segments) {
      feature.subfeatures = g.segments.map((s, j) => ({
        refName,
        uniqueId: `${i}-${j}`,
        start: s.start - 1,
        end: s.end,
        strand,
        fill,
      }))
    }
    return feature
  })
}

// write the reference as an indexed FASTA (`<slug>.fa` + `.fai`); samtools
// builds the index so it matches the runtime IndexedFastaAdapter exactly
function writeFasta(outDir, slug, refName, seq) {
  const wrapped = seq.match(/.{1,80}/g)?.join('\n') ?? ''
  const fa = join(outDir, `${slug}.fa`)
  writeFileSync(fa, `>${refName}\n${wrapped}\n`)
  execFileSync('samtools', ['faidx', fa])
  return fa
}

// write the per-position diversity as a bigWig via UCSC bedGraphToBigWig. The
// entropy features are already 1bp and start-sorted, exactly one score per base.
function writeEntropyBigWig(outDir, slug, refName, len, features) {
  const bedGraph = join(outDir, `${slug}_entropy.bedGraph`)
  const chromSizes = join(outDir, `${slug}.chrom.sizes`)
  const bw = join(outDir, `${slug}_entropy.bw`)
  const lines = features.map(
    f => `${refName}\t${f.start}\t${f.end}\t${f.score}`,
  )
  writeFileSync(bedGraph, `${lines.join('\n')}\n`)
  writeFileSync(chromSizes, `${refName}\t${len}\n`)
  execFileSync('bedGraphToBigWig', [bedGraph, chromSizes, bw])
  // only the .bw is hosted; drop the plain-text intermediates
  rmSync(bedGraph)
  rmSync(chromSizes)
  return bw
}

// align every published NCBI genome (the same sequence set Nextstrain ingests)
// to the hosted reference and emit a reference-based CRAM. CRAM stores each read
// as substitutions relative to the reference, so JBrowse renders SNPs directly
// off the shared assembly sequence — no MD tag / `samtools calmd` needed.
async function writeGenomesCram(outDir, slug, refFasta, seqsUrl) {
  const zst = join(outDir, `${slug}_seqs.fasta.zst`)
  const fasta = join(outDir, `${slug}_seqs.fasta`)
  const cram = join(outDir, `${slug}_genomes.cram`)
  const res = await fetch(seqsUrl)
  if (!res.ok) {
    throw new Error(`failed to fetch ${seqsUrl}: ${res.status}`)
  }
  writeFileSync(zst, Buffer.from(await res.arrayBuffer()))
  execFileSync('zstd', ['-d', '-f', zst])
  execSync(
    `minimap2 -a -x asm20 ${refFasta} ${fasta} | ` +
      `samtools sort -O cram --reference ${refFasta} -o ${cram} -`,
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
  execFileSync('samtools', ['index', cram])
  rmSync(zst)
  rmSync(fasta)
  return cram
}

// emit the reconstructed per-tip genotypes as a bgzipped+tabixed VCF plus a
// samplesTsv of each tip's metadata, so JBrowse's multi-sample variant matrix
// renders samples x sites colored/grouped by region — the genotype table behind
// the Nextstrain tree, in genome coordinates.
function writeGenotypeVcf(outDir, slug, refName, len, { rootBase, tips }) {
  const samples = tips.map(t => t.name)
  const positions = Object.keys(rootBase)
    .map(Number)
    .filter(pos => isBase(rootBase[pos]))
    .sort((a, b) => a - b)

  const rows = []
  for (const pos of positions) {
    const ref = rootBase[pos]
    const altIndex = {} // base -> 1-based ALT index
    const alts = []
    const calls = tips.map(tip => {
      const base = pos in tip.muts ? tip.muts[pos] : ref
      if (!isBase(base)) {
        return '.'
      }
      if (base === ref) {
        return '0'
      }
      if (!(base in altIndex)) {
        alts.push(base)
        altIndex[base] = alts.length
      }
      return String(altIndex[base])
    })
    if (alts.length > 0) {
      rows.push(
        `${refName}\t${pos}\t.\t${ref}\t${alts.join(',')}\t.\t.\t.\tGT\t` +
          calls.join('\t'),
      )
    }
  }

  const vcf = join(outDir, `${slug}_genotypes.vcf`)
  writeFileSync(
    vcf,
    [
      '##fileformat=VCFv4.3',
      `##contig=<ID=${refName},length=${len}>`,
      '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
      `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}`,
      ...rows,
      '',
    ].join('\n'),
  )
  execFileSync('bgzip', ['-f', vcf])
  execFileSync('tabix', ['-p', 'vcf', `${vcf}.gz`])

  const tsv = join(outDir, `${slug}_samples.tsv`)
  writeFileSync(
    tsv,
    [
      'name\tregion\tcountry\tdate',
      ...tips.map(
        t => `${t.name}\t${t.meta.region}\t${t.meta.country}\t${t.meta.date}`,
      ),
      '',
    ].join('\n'),
  )
  return { samples: samples.length, sites: rows.length }
}

// sanitize a tip name for newick/FASTA (drop whitespace and newick delimiters)
const safeName = name => name.replace(/[\s(),:;]+/g, '_')

// Pick n tip names spread evenly across the tree's DFS order (deterministic).
function subsampleTipNames(tips, n) {
  if (tips.length <= n) {
    return new Set(tips.map(t => t.name))
  }
  const keep = new Set()
  const step = tips.length / n
  for (let i = 0; i < n; i++) {
    keep.add(tips[Math.floor(i * step)].name)
  }
  return keep
}

// Newick of the tree pruned to `keep`, collapsing internal nodes that lose all
// but one surviving child (summing branch lengths). Branch length = delta of
// node_attrs.div (nucleotide divergence) from parent.
function buildNewick(tree, keep) {
  const div = n => n.node_attrs?.div ?? 0
  const rec = (node, parentDiv) => {
    const bl = Math.max(0, div(node) - parentDiv)
    const children = node.children || []
    if (children.length === 0) {
      return keep.has(node.name)
        ? { nwk: safeName(node.name), len: bl }
        : undefined
    }
    const kids = children.map(c => rec(c, div(node))).filter(Boolean)
    if (kids.length === 0) {
      return undefined
    }
    if (kids.length === 1) {
      return { nwk: kids[0].nwk, len: bl + kids[0].len }
    }
    const inner = kids.map(k => `${k.nwk}:${k.len.toFixed(6)}`).join(',')
    return { nwk: `(${inner})`, len: bl }
  }
  const r = rec(tree, div(tree))
  return r ? `${r.nwk};\n` : ';\n'
}

// Reconstruct each kept tip's sequence in reference coordinates: the reference
// with that tip's nucleotide mutations applied. Nextstrain sequences are already
// reference-aligned, so this is a gap-free MSA (deletions arrive as '-' muts).
function reconstructMsaFasta(seq, tips, keep) {
  const rows = []
  for (const tip of tips) {
    if (keep.has(tip.name)) {
      const chars = seq.split('')
      for (const posStr in tip.muts) {
        const pos = +posStr
        if (pos >= 1 && pos <= chars.length) {
          chars[pos - 1] = tip.muts[posStr]
        }
      }
      rows.push(`>${safeName(tip.name)}\n${chars.join('')}`)
    }
  }
  return `${rows.join('\n')}\n`
}

// write a subsampled MSA (<slug>_msa.fasta) + matching pruned tree (<slug>.nwk)
// for react-msaview; the MSA and tree share the exact same tip set.
function writeMsaTree(outDir, slug, seq, tips, tree, nTips = 80) {
  const keep = subsampleTipNames(tips, nTips)
  writeFileSync(
    join(outDir, `${slug}_msa.fasta`),
    reconstructMsaFasta(seq, tips, keep),
  )
  writeFileSync(join(outDir, `${slug}.nwk`), buildNewick(tree, keep))
  return keep.size
}

function buildConfig({ assembly, slug, geneFeats, seq, genomesCram }) {
  const len = seq.length
  const base = `${S3_BASE}/${slug}`

  // optional real-data track: every published genome for this pathogen (NCBI via
  // Nextstrain), aligned to the hosted reference as a CRAM. This is the one part
  // that streams at runtime; everything else is inline or a small flatfile.
  const genomesTrackId = `${assembly}-published-genomes`
  const publishedGenomesTracks = genomesCram
    ? [
        {
          type: 'AlignmentsTrack',
          name: 'Published genomes (NCBI via Nextstrain)',
          trackId: genomesTrackId,
          assemblyNames: [assembly],
          category: ['Nextstrain'],
          adapter: {
            type: 'CramAdapter',
            cramLocation: { uri: genomesCram },
            craiLocation: { uri: `${genomesCram}.crai` },
          },
        },
      ]
    : []
  const publishedGenomesSession = genomesCram
    ? [
        {
          type: 'AlignmentsTrack',
          configuration: genomesTrackId,
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: `${genomesTrackId}-LinearAlignmentsDisplay`,
            },
          ],
        },
      ]
    : []
  return {
    assembly: {
      name: assembly,
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: `${assembly}-ReferenceSequenceTrack`,
        adapter: {
          type: 'IndexedFastaAdapter',
          fastaLocation: { uri: `${base}/${slug}.fa` },
          faiLocation: { uri: `${base}/${slug}.fa.fai` },
        },
      },
    },
    tracks: [
      {
        type: 'FeatureTrack',
        name: 'Nextstrain annotations',
        trackId: `${assembly}-nextstrain-annotations`,
        assemblyNames: [assembly],
        category: ['Annotation'],
        adapter: {
          type: 'FromConfigAdapter',
          features: geneFeats,
        },
        displays: [
          {
            type: 'LinearBasicDisplay',
            displayId: `${assembly}-nextstrain-color-display`,
            renderer: {
              type: 'SvgFeatureRenderer',
              color1: "jexl:get(feature,'fill') || 'black'",
            },
          },
        ],
      },
      {
        type: 'QuantitativeTrack',
        name: 'Diversity (entropy)',
        trackId: `${assembly}-entropy-score`,
        assemblyNames: [assembly],
        category: ['Annotation'],
        adapter: {
          type: 'BigWigAdapter',
          bigWigLocation: { uri: `${base}/${slug}_entropy.bw` },
        },
      },
      {
        type: 'VariantTrack',
        name: 'Sample genotypes',
        trackId: `${assembly}-genotypes`,
        assemblyNames: [assembly],
        category: ['Nextstrain'],
        adapter: {
          type: 'VcfTabixAdapter',
          vcfGzLocation: { uri: `${base}/${slug}_genotypes.vcf.gz` },
          index: { location: { uri: `${base}/${slug}_genotypes.vcf.gz.tbi` } },
          samplesTsvLocation: { uri: `${base}/${slug}_samples.tsv` },
        },
      },
      ...publishedGenomesTracks,
    ],
    location: `${assembly}:1..${len.toLocaleString('en-US')}`,
    defaultSession: {
      name: 'My session',
      view: {
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'QuantitativeTrack',
            configuration: `${assembly}-entropy-score`,
            displays: [
              {
                type: 'LinearWiggleDisplay',
                displayId: `${assembly}-entropy-score-LinearWiggleDisplay`,
                renderers: {
                  DensityRenderer: { type: 'DensityRenderer' },
                  XYPlotRenderer: { type: 'XYPlotRenderer' },
                  LinePlotRenderer: { type: 'LinePlotRenderer' },
                },
              },
            ],
          },
          {
            type: 'FeatureTrack',
            configuration: `${assembly}-nextstrain-annotations`,
            displays: [
              {
                type: 'LinearBasicDisplay',
                configuration: `${assembly}-nextstrain-color-display`,
              },
            ],
          },
          {
            type: 'VariantTrack',
            configuration: `${assembly}-genotypes`,
            displays: [
              {
                type: 'LinearMultiSampleVariantMatrixDisplay',
                displayId: `${assembly}-genotypes-LinearMultiSampleVariantMatrixDisplay`,
                height: 400,
                colorBy: 'region',
              },
            ],
          },
          ...publishedGenomesSession,
          {
            type: 'ReferenceSequenceTrack',
            configuration: `${assembly}-ReferenceSequenceTrack`,
            displays: [
              {
                type: 'LinearReferenceSequenceDisplay',
                configuration: `${assembly}-ReferenceSequenceTrack-LinearReferenceSequenceDisplay`,
              },
            ],
          },
        ],
      },
    },
  }
}

const fetchText = async url => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`failed to fetch ${url}: ${res.status} ${res.statusText}`)
  }
  return res.text()
}

// Nextstrain publishes the tree root sequence as a `_root-sequence.json` sidecar
// next to the dataset; its `nuc` is the reference, coordinate-matched to the
// mutations. Fall back to the build-repo GenBank `ref` when it isn't published.
const referenceSequence = async ds => {
  const sidecar = ds.url.replace(/\.json$/, '_root-sequence.json')
  const res = await fetch(sidecar)
  if (res.ok) {
    const nuc = (await res.json()).nuc
    if (nuc) {
      return { seq: nuc.toUpperCase(), source: 'root-sequence' }
    }
  }
  if (!ds.ref) {
    throw new Error(`${ds.file}: no root-sequence sidecar and no ref fallback`)
  }
  return { seq: gbSequence(await fetchText(ds.ref)), source: 'genbank' }
}

for (const ds of DATASETS) {
  const data = JSON.parse(await fetchText(ds.url))
  const { seq, source } = await referenceSequence(ds)
  const refName = ds.assembly
  const geneFeats = geneFeatures(
    data.meta.genome_annotations,
    refName,
    ds.polyprotein,
  )
  const entropyFeats = entropyFeatures(data.tree, refName)

  // the reference must span every annotation/diversity coordinate
  const maxEnd = Math.max(
    ...geneFeats.map(f => f.end),
    ...entropyFeats.map(f => f.end),
  )
  if (maxEnd > seq.length) {
    throw new Error(
      `${ds.file}: feature end ${maxEnd} exceeds reference length ${seq.length}`,
    )
  }

  const outDir = join(dataDir, ds.slug)
  mkdirSync(outDir, { recursive: true })
  const refFasta = writeFasta(outDir, ds.slug, refName, seq)
  writeEntropyBigWig(outDir, ds.slug, refName, seq.length, entropyFeats)
  const genotypes = genotypeData(data.tree)
  const gt = writeGenotypeVcf(outDir, ds.slug, refName, seq.length, genotypes)
  const msaTips = writeMsaTree(outDir, ds.slug, seq, genotypes.tips, data.tree)
  if (ds.genomesSeqs) {
    await writeGenomesCram(outDir, ds.slug, refFasta, ds.genomesSeqs)
  }

  const config = buildConfig({
    assembly: ds.assembly,
    slug: ds.slug,
    geneFeats,
    seq,
    genomesCram: ds.genomesSeqs
      ? `${S3_BASE}/${ds.slug}/${ds.slug}_genomes.cram`
      : undefined,
  })
  writeFileSync(join(exampleDir, `${ds.file}.json`), JSON.stringify(config))
  console.log(
    `wrote ${ds.file}.json + ${ds.slug}/ flatfiles — ${seq.length} bp ` +
      `reference (${source}), ${geneFeats.length} genes, ` +
      `${entropyFeats.length} diversity points, ` +
      `${gt.samples}×${gt.sites} genotype matrix, ` +
      `${msaTips}-tip MSA+tree`,
  )
}
