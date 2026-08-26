// Compare a prediction GFF against a reference annotation and put every
// predicted transcript in exactly one class.
//
// The comparison is at EXON level against SAME-STRAND genes. Span overlap is
// the obvious test and it is wrong: a gene nested in another gene's intron on
// the opposite strand overlaps its whole span and shares no exon, so a span
// test reports a perfectly good prediction as a two-gene fusion.
import fs from 'node:fs'
import zlib from 'node:zlib'

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
    if (i > 0) {o[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim())}
  }
  return o
}

export function readGff(file, wanted) {
  const raw = file.endsWith('.gz')
    ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')
    : fs.readFileSync(file, 'utf8')
  const out = []
  for (const line of raw.split('\n')) {
    if (!line || line.startsWith('#')) {continue}
    const f = line.split('\t')
    if (f.length < 9) {continue}
    if (wanted && !wanted.has(f[2])) {continue}
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

// Introns as pairs rather than as a set of strings, because a card that says a
// splice site moved is only actionable once it says by how far.
function introns(exons) {
  const s = [...exons].sort((x, y) => x.start - y.start)
  return s.slice(1).map((e, i) => ({ start: s[i].end, end: e.start }))
}

const key = j => `${j.start}-${j.end}`

// A gene's junctions are the UNION of its transcripts' introns. Sorting every
// isoform's exons into one list and joining consecutive pairs is the obvious
// shortcut and it invents junctions no transcript has: across RANBP1's 13
// isoforms it matched none of Tiberius's five correct junctions, and 18 of the
// 21 structure conflicts it reported on chr22 were that arithmetic rather than
// the prediction.
const geneJunctions = (txs, exonsByTx) =>
  new Set(txs.flatMap(t => introns(exonsByTx.get(t) || []).map(key)))

const signed = n => (n > 0 ? `+${n}` : String(n))

const widest = (list, of) =>
  list.reduce((a, b) => (of(b) > of(a) ? b : a), list[0])

const nearest = (list, of) =>
  list.reduce((a, b) => (Math.abs(of(b)) < Math.abs(of(a)) ? b : a))

// Which of a handful of disagreements this one is. The class tells a reviewer
// that a model and the reference differ; this tells them what the edit is, and
// a splice site that moved 12 bp and an intron cut through the middle of a
// reference exon are the same class and completely different edits.
function describe(j, refIntrons, refExons) {
  // Ahead of the splice-site tests on purpose. An intron that jumps a whole
  // reference exon lands on two real splice sites, one of them usually a donor
  // the reference also uses, and asking about the donor first reports an exon
  // skip as a splice site 900 bp out of place.
  const skipped = refExons.filter(e => j.start <= e.start && e.end <= j.end)
  if (skipped.length) {
    const n = skipped.length
    return { kind: 'skips', skipped: n, label: `skips-${n}-exon${n > 1 ? 's' : ''}` }
  }
  const sameAcceptor = refIntrons.filter(r => r.end === j.end)
  const sameDonor = refIntrons.filter(r => r.start === j.start)
  // Both ends are splice sites the reference uses and this pairing of them is
  // not — an isoform the reference does not carry, rather than a site in the
  // wrong place.
  if (sameAcceptor.length && sameDonor.length) {
    return { kind: 'pairing', label: 'unannotated-pairing' }
  }
  if (sameAcceptor.length) {
    const shift = nearest(sameAcceptor, r => r.start - j.start).start - j.start
    return { kind: 'donor', shift, label: `donor${signed(shift)}` }
  }
  if (sameDonor.length) {
    const shift = nearest(sameDonor, r => r.end - j.end).end - j.end
    return { kind: 'acceptor', shift, label: `acceptor${signed(shift)}` }
  }
  if (refExons.some(e => e.start < j.start && j.end < e.end)) {
    return { kind: 'in-exon', label: 'intron-in-exon' }
  }
  const over = refIntrons.filter(r => overlaps(r, j))
  if (over.length) {
    const r = widest(over, x => Math.min(x.end, j.end) - Math.max(x.start, j.start))
    const shift = r.start - j.start
    return {
      kind: 'shifted',
      shift,
      acceptorShift: r.end - j.end,
      label: `shifted${signed(shift)}`,
    }
  }
  return { kind: 'novel', label: 'novel-intron' }
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
    if (!keep(f)) {continue}
    const bucket = f.type === 'exon' ? exon : f.type === 'CDS' ? cds : null
    if (!bucket) {continue}
    const k = keyOf(f)
    if (k === undefined || k === null) {continue}
    if (!bucket.has(k)) {bucket.set(k, [])}
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
    if (f.type !== 'mRNA' && f.type !== 'transcript') {continue}
    if (f.attrs.ID) {txToGene.set(f.attrs.ID, f.attrs.Parent)}
  }
  // Keyed by TRANSCRIPT, then grouped: an exon may hang off the transcript, or
  // straight off the gene, and either way a gene's junctions have to be read one
  // isoform at a time.
  const exonsByTx = blocksBy(refFeatures, f => f.attrs.Parent, keep)
  const txsOfGene = new Map()
  for (const tx of exonsByTx.keys()) {
    const g = txToGene.get(tx) ?? tx
    if (!txsOfGene.has(g)) {txsOfGene.set(g, [])}
    txsOfGene.get(g).push(tx)
  }
  const exonsByGene = new Map(
    [...txsOfGene].map(([g, txs]) => [
      g,
      txs.flatMap(t => exonsByTx.get(t) || []),
    ]),
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
    if (!byContig.has(g.refName)) {byContig.set(g.refName, [])}
    byContig.get(g.refName).push(g)
  }
  for (const list of byContig.values()) {list.sort((a, b) => a.start - b.start)}

  const transcripts = predFeatures.filter(f => (f.type === 'transcript' || f.type === 'mRNA') && keep(f))
  const predExons = blocksBy(predFeatures, f => f.attrs.Parent, keep)

  const rows = []
  for (const t of transcripts) {
    const id = t.attrs.ID || t.attrs.Name
    const exons = predExons.get(id) || []
    if (!exons.length) {continue}

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

    const predIntrons = introns(exons)
    const refJunctions = geneJunctions(
      sameStrandCoding.flatMap(g => txsOfGene.get(g) || []),
      exonsByTx,
    )
    const shared = predIntrons.filter(j => refJunctions.has(key(j))).length

    let cls
    if (touched.length === 0) {cls = 'novel-locus'}
    else if (sameStrandCoding.length === 0) {cls = 'novel-coding'}
    else if (sameStrandCoding.length > 1) {cls = 'merge'}
    else {
      cls = predIntrons.length > 0 && shared === 0 ? 'structure-conflict' : 'agrees'
    }

    const recs = sameStrandCoding.map(n => geneRecord.get(n)).filter(Boolean)
    // Overlapping same-strand genes are a fact about the reference, not a
    // prediction error, so only a fusion of genes that miss each other counts.
    const disjoint =
      recs.length >= 2 &&
      !isReadthrough(recs.map(r => r.name)) &&
      recs.every((a, i) => recs.every((b, j) => i === j || !overlaps(a, b)))
    if (cls === 'merge' && !disjoint) {cls = 'agrees'}

    // Where an annotator cuts a merged model: the intergenic space between the
    // genes it ran together. Not an intron of the model — a merge can put an
    // exon in the gap, and then no single junction crosses it.
    const gaps = []
    if (cls === 'merge') {
      const sorted = [...recs].sort((a, b) => a.start - b.start)
      for (let i = 1; i < sorted.length; i++) {
        const start = sorted[i - 1].end
        const end = sorted[i].start
        if (end > start) {gaps.push({ start, end })}
      }
    }
    const gapBp = gaps.length ? Math.max(...gaps.map(g => g.end - g.start)) : null

    // Computed for every model with a coding gene to compare against, agreeing
    // ones included: a model that shares four junctions out of five is filed as
    // `agrees` and still carries one real splice-site edit, and conflicts.bed is
    // where that becomes visible. A model with no such gene has nothing to
    // disagree WITH, so its finding is its span rather than its introns.
    const refIntrons = sameStrandCoding
      .flatMap(g => txsOfGene.get(g) || [])
      .flatMap(tx => introns(exonsByTx.get(tx) || []))
    const refExons = [
      ...new Map(
        sameStrandCoding
          .flatMap(g => exonsByGene.get(g) || [])
          .map(e => [key(e), e]),
      ).values(),
    ]
    const conflicts = sameStrandCoding.length
      ? predIntrons.flatMap((j, i) =>
          refJunctions.has(key(j))
            ? []
            : [
                {
                  index: i + 1,
                  of: predIntrons.length,
                  start: j.start,
                  end: j.end,
                  ...describe(j, refIntrons, refExons),
                },
              ],
        )
      : []

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
      gaps,
      sharedJunctions: shared,
      conflicts,
    })
  }

  const tally = {}
  for (const r of rows) {tally[r.cls] = (tally[r.cls] || 0) + 1}
  return { rows, tally, total: rows.length }
}

// One line per place a model and the reference actually differ. A card can only
// show the models the portal picked; this is every disagreement on the contig,
// in a format bedtools and any other browser already read.
export function conflictBed(rows) {
  const out = []
  for (const r of rows) {
    const add = (start, end, what) =>
      out.push([r.refName, start, end, `${r.id}:${what}`, 0, r.strand])
    if (r.cls === 'merge') {
      // The finding is the cut, not the junctions either side of it
      for (const g of r.gaps) {add(g.start, g.end, 'split')}
    } else if (r.cls === 'novel-locus' || r.cls === 'novel-coding') {
      add(r.start, r.end, r.cls)
    } else {
      // An intron of zero or negative length means the model's own exons
      // overlap, which tabix rejects and which would take the build down with it
      for (const c of r.conflicts.filter(c => c.end > c.start)) {
        add(c.start, c.end, c.label)
      }
    }
  }
  out.sort(
    (a, b) =>
      String(a[0]).localeCompare(String(b[0])) || a[1] - b[1] || a[2] - b[2],
  )
  const header = [
    '#chrom\tstart\tend\tname\tscore\tstrand',
    '# name is <predicted transcript>:<what disagrees>. donor+N / acceptor+N give',
    '# the bp the reference splice site sits away from the predicted one.',
  ]
  return `${[...header, ...out.map(l => l.join('\t'))].join('\n')}\n`
}
