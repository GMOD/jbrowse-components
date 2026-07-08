// Regenerates the inline Nextstrain demo configs under src/examples from live
// Nextstrain (auspice v2) datasets. Each demo is fully self-contained: the real
// reference sequence, a gene-annotation FeatureTrack built from
// meta.genome_annotations, and a per-position diversity (Shannon-entropy)
// QuantitativeTrack reconstructed from the tree's nucleotide mutations.
//
// The reference sequence is Nextstrain's own published `<name>_root-sequence.json`
// sidecar (the tree root, coordinate-matched to the dataset by construction).
// A few datasets don't publish that sidecar, so `ref` gives a fallback GenBank
// reference from the build repo. New pathogens: extend DATASETS below.
//
// Usage: node scripts/gen-nextstrain-demos.mjs
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const exampleDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'examples',
)

// each entry becomes src/examples/<file>.json, consumed by a matching
// <name>.tsx / <slug>.astro page. `assembly` is the JBrowse assembly + refName;
// `url` is the auspice v2 dataset. `ref` is only needed when the dataset has no
// published root-sequence sidecar (zika, measles).
const DATASETS = [
  {
    file: 'nextstrain_covid',
    assembly: 'SARS-CoV-2',
    url: 'https://data.nextstrain.org/ncov_open_global_6m.json',
  },
  {
    file: 'nextstrain_zika',
    assembly: 'Zika',
    url: 'https://data.nextstrain.org/zika.json',
    ref: 'https://raw.githubusercontent.com/nextstrain/zika/main/phylogenetic/defaults/reference.gb',
    polyprotein: true,
    genomesBam: 'https://jbrowse.org/demos/nextstrain/zika/zika_genomes.bam',
  },
  {
    file: 'nextstrain_ebola',
    assembly: 'Ebola',
    url: 'https://data.nextstrain.org/ebola.json',
  },
  {
    file: 'nextstrain_measles',
    assembly: 'Measles',
    url: 'https://data.nextstrain.org/measles.json',
    ref: 'https://raw.githubusercontent.com/nextstrain/measles/main/phylogenetic/defaults/measles_reference_genome.gb',
    genomesBam:
      'https://jbrowse.org/demos/nextstrain/measles/measles_genomes.bam',
  },
  {
    file: 'nextstrain_rsv_a',
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

function buildConfig({ assembly, data, seq, polyprotein, genomesBam }) {
  const refName = assembly
  const len = seq.length

  // optional real-data track: every published genome for this pathogen (NCBI via
  // Nextstrain), aligned to the reference and hosted on jbrowse.org/demos. This
  // is the one part that streams at runtime; everything else is inline.
  const genomesTrackId = `${assembly}-published-genomes`
  const publishedGenomesTracks = genomesBam
    ? [
        {
          type: 'AlignmentsTrack',
          name: 'Published genomes (NCBI via Nextstrain)',
          trackId: genomesTrackId,
          assemblyNames: [assembly],
          category: ['Nextstrain'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: { uri: genomesBam },
            index: { location: { uri: `${genomesBam}.bai` } },
          },
        },
      ]
    : []
  const publishedGenomesSession = genomesBam
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
          type: 'FromConfigSequenceAdapter',
          features: [{ refName, uniqueId: refName, start: 0, end: len, seq }],
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
          features: geneFeatures(
            data.meta.genome_annotations,
            refName,
            polyprotein,
          ),
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
          type: 'FromConfigAdapter',
          features: entropyFeatures(data.tree, refName),
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
  const config = buildConfig({
    assembly: ds.assembly,
    data,
    seq,
    polyprotein: ds.polyprotein,
    genomesBam: ds.genomesBam,
  })
  const [genes, entropy] = config.tracks
  // the reference must span every annotation/diversity coordinate
  const maxEnd = Math.max(
    ...genes.adapter.features.map(f => f.end),
    ...entropy.adapter.features.map(f => f.end),
  )
  if (maxEnd > seq.length) {
    throw new Error(
      `${ds.file}: feature end ${maxEnd} exceeds reference length ${seq.length}`,
    )
  }
  writeFileSync(join(exampleDir, `${ds.file}.json`), JSON.stringify(config))
  console.log(
    `wrote ${ds.file}.json — ${seq.length} bp reference (${source}), ` +
      `${genes.adapter.features.length} genes, ` +
      `${entropy.adapter.features.length} diversity points`,
  )
}
