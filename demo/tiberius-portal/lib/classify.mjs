// Compare a prediction GFF against a reference annotation and put every
// predicted transcript in exactly one class.
//
// The comparison is at EXON level against SAME-STRAND genes. Span overlap is
// the obvious test and it is wrong: a gene nested in another gene's intron on
// the opposite strand overlaps its whole span and shares no exon, so a span
// test reports a perfectly good prediction as a two-gene fusion.
import fs from 'fs'
import zlib from 'zlib'

export const CLASSES = {
  merge: {
    label: 'Merged model',
    why: 'One prediction covers two separate reference genes.',
    action: 'Split into two models',
  },
  'structure-conflict': {
    label: 'Structure conflict',
    why: 'Covers one reference gene but shares none of its splice junctions.',
    action: 'Check exon structure',
  },
  'novel-locus': {
    label: 'Novel locus',
    why: 'Predicted where the reference annotates nothing at all.',
    action: 'Assess, then create',
  },
  'novel-coding': {
    label: 'Novel coding',
    why: 'Predicted coding where the reference has only non-coding annotation.',
    action: 'Assess coding potential',
  },
  agrees: {
    label: 'Agrees',
    why: 'Shares splice junctions with a reference gene.',
    action: 'No action',
  },
}

function attrs(s) {
  const o = {}
  for (const kv of (s || '').split(';')) {
    const i = kv.indexOf('=')
    if (i > 0) o[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim())
  }
  return o
}

export function readGff(file, wanted) {
  const raw = file.endsWith('.gz')
    ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')
    : fs.readFileSync(file, 'utf8')
  const out = []
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const f = line.split('\t')
    if (f.length < 9) continue
    if (wanted && !wanted.has(f[2])) continue
    out.push({
      refName: f[0],
      type: f[2],
      start: +f[3] - 1,
      end: +f[4],
      strand: f[6],
      attrs: attrs(f[8]),
    })
  }
  return out
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end

function junctions(exons) {
  const s = [...exons].sort((x, y) => x.start - y.start)
  const j = new Set()
  for (let i = 0; i < s.length - 1; i++) j.add(`${s[i].end}-${s[i + 1].start}`)
  return j
}

// Gencode and most reference GFFs put the readable name on gene_name; fall back
// through Name and ID so a plain GFF still labels.
const geneName = f => f.attrs.gene_name || f.attrs.Name || f.attrs.gene_id || f.attrs.ID || 'unnamed'
const geneType = f => f.attrs.gene_type || f.attrs.biotype || f.attrs.gene_biotype || 'protein_coding'

// A readthrough gene (CHKB-CPT1B) is the reference's own fused model, so a
// prediction covering it and one of its halves is not a merge.
const isReadthrough = names =>
  names.some(n => n.includes('-') && names.some(m => m !== n && n.split('-').includes(m)))

// Plenty of annotation files carry CDS and no exon at all (volvox's test GFF,
// and some AUGUSTUS/BRAKER output). Prefer exon where a model has them and fall
// back to CDS per model, rather than mixing the two within one comparison.
function blocksBy(features, keyOf, keep) {
  const exon = new Map()
  const cds = new Map()
  for (const f of features) {
    if (!keep(f)) continue
    const bucket = f.type === 'exon' ? exon : f.type === 'CDS' ? cds : null
    if (!bucket) continue
    const k = keyOf(f)
    if (k === undefined || k === null) continue
    if (!bucket.has(k)) bucket.set(k, [])
    bucket.get(k).push(f)
  }
  const out = new Map()
  for (const k of new Set([...exon.keys(), ...cds.keys()])) {
    out.set(k, exon.get(k)?.length ? exon.get(k) : cds.get(k) || [])
  }
  return out
}

export function classify({ predictionFile, referenceFile, refNames }) {
  const refFeatures = readGff(referenceFile, new Set(['gene', 'mRNA', 'transcript', 'exon', 'CDS']))
  const predFeatures = readGff(predictionFile, new Set(['transcript', 'mRNA', 'exon', 'CDS']))

  const keep = f => !refNames || refNames.has(f.refName)

  const genes = refFeatures.filter(f => f.type === 'gene' && keep(f))
  const geneId = g => g.attrs.ID || g.attrs.gene_id || geneName(g)

  // exon -> transcript -> gene. Keying an exon by a name attribute of its own
  // works on Gencode, which repeats gene_name on every line, and silently
  // collapses every exon in a plain GFF3 into one bucket.
  const txToGene = new Map()
  for (const f of refFeatures) {
    if (f.type !== 'mRNA' && f.type !== 'transcript') continue
    if (f.attrs.ID) txToGene.set(f.attrs.ID, f.attrs.Parent)
  }
  const exonsByGene = blocksBy(
    refFeatures,
    f => {
      const p = f.attrs.Parent
      // an exon may hang off the transcript, or straight off the gene
      return txToGene.get(p) ?? p
    },
    keep,
  )

  const geneRecord = new Map()
  for (const g of genes) {
    const id = geneId(g)
    const prev = geneRecord.get(id)
    if (!prev || g.end - g.start > prev.end - prev.start) {
      geneRecord.set(id, {
        id,
        name: geneName(g),
        start: g.start,
        end: g.end,
        strand: g.strand,
        type: geneType(g),
        refName: g.refName,
      })
    }
  }

  const byContig = new Map()
  for (const g of genes) {
    if (!byContig.has(g.refName)) byContig.set(g.refName, [])
    byContig.get(g.refName).push(g)
  }
  for (const list of byContig.values()) list.sort((a, b) => a.start - b.start)

  const transcripts = predFeatures.filter(f => (f.type === 'transcript' || f.type === 'mRNA') && keep(f))
  const predExons = blocksBy(predFeatures, f => f.attrs.Parent, keep)

  const rows = []
  for (const t of transcripts) {
    const id = t.attrs.ID || t.attrs.Name
    const exons = predExons.get(id) || []
    if (!exons.length) continue

    const near = (byContig.get(t.refName) || []).filter(g => overlaps(t, g))
    const touched = near.filter(g => {
      const ge = exonsByGene.get(geneId(g)) || []
      return exons.some(te => ge.some(e => overlaps(te, e)))
    })

    const sameStrandCoding = [
      ...new Set(
        touched
          .filter(g => geneType(g) === 'protein_coding' && g.strand === t.strand)
          .map(geneId),
      ),
    ]

    const tj = junctions(exons)
    let cls
    if (touched.length === 0) cls = 'novel-locus'
    else if (sameStrandCoding.length === 0) cls = 'novel-coding'
    else if (sameStrandCoding.length > 1) cls = 'merge'
    else {
      const gj = junctions(exonsByGene.get(sameStrandCoding[0]) || [])
      const shared = [...tj].filter(x => gj.has(x)).length
      cls = tj.size > 0 && shared === 0 ? 'structure-conflict' : 'agrees'
    }

    const recs = sameStrandCoding.map(n => geneRecord.get(n)).filter(Boolean)
    // Overlapping same-strand genes are a fact about the reference, not a
    // prediction error, so only a fusion of genes that miss each other counts.
    const disjoint =
      recs.length >= 2 &&
      !isReadthrough(recs.map(r => r.name)) &&
      recs.every((a, i) => recs.every((b, j) => i === j || !overlaps(a, b)))
    if (cls === 'merge' && !disjoint) cls = 'agrees'

    let gapBp = null
    if (cls === 'merge') {
      const sorted = [...recs].sort((a, b) => a.start - b.start)
      gapBp = sorted.slice(1).reduce((m, g, i) => Math.max(m, g.start - sorted[i].end), 0)
    }

    rows.push({
      id,
      refName: t.refName,
      start: t.start,
      end: t.end,
      strand: t.strand,
      span: t.end - t.start,
      nExons: exons.length,
      cls,
      genes:
        cls === 'merge'
          ? recs.map(r => r.name)
          : [...new Set(touched.map(geneName))].slice(0, 3),
      gapBp,
    })
  }

  const tally = {}
  for (const r of rows) tally[r.cls] = (tally[r.cls] || 0) + 1
  return { rows, tally, total: rows.length }
}
