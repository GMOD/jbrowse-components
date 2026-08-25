import fs from 'fs'

const DIR =
  '/tmp/claude-1001/-home-cdiesh-src-jbrowse-components/262270f7-1cc8-4aa7-87fe-681ca886d010/scratchpad/tib'

function attrs(s) {
  const o = {}
  for (const kv of s.split(';')) {
    const i = kv.indexOf('=')
    if (i > 0)
      o[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim())
  }
  return o
}

const genes = new Map()
for (const l of fs
  .readFileSync(`${DIR}/gencode_chr22_all.gff`, 'utf8')
  .split('\n')) {
  if (!l || l.startsWith('#')) continue
  const f = l.split('\t')
  if (f[2] !== 'gene') continue
  const a = attrs(f[8])
  const n = a.gene_name || a.gene_id
  const rec = {
    name: n,
    start: +f[3] - 1,
    end: +f[4],
    strand: f[6],
    type: a.gene_type,
  }
  // keep the widest record for a name reused across loci
  const prev = genes.get(n)
  if (!prev || rec.end - rec.start > prev.end - prev.start) genes.set(n, rec)
}

const rows = JSON.parse(fs.readFileSync(`${DIR}/candidates2.json`, 'utf8'))
const overlaps = (a, b) => a.start < b.end && b.start < a.end
const isReadthrough = names =>
  names.some(
    n =>
      n.includes('-') && names.some(m => m !== n && n.split('-').includes(m)),
  )

for (const r of rows) {
  r.mergedRecs = r.mergedGenes.map(n => genes.get(n)).filter(Boolean)
  // A fusion is unambiguous only when the genes it joins do not overlap each
  // other: overlapping same-strand genes are a Gencode fact, not a prediction
  // error, and a readthrough gene is Gencode's own fused model.
  r.cleanMerge =
    r.cls === 'merge' &&
    !isReadthrough(r.mergedGenes) &&
    r.mergedRecs.length >= 2 &&
    r.mergedRecs.every((a, i) =>
      r.mergedRecs.every((b, j) => i === j || !overlaps(a, b)),
    )
  if (r.cleanMerge) {
    const sorted = [...r.mergedRecs].sort((a, b) => a.start - b.start)
    r.gapBp = sorted
      .slice(1)
      .reduce((m, g, i) => Math.max(m, g.start - sorted[i].end), 0)
  }
}

const cleanMerges = rows
  .filter(r => r.cleanMerge)
  .sort((a, b) => b.nExons - a.nExons)

console.log('clean merges:', cleanMerges.length)
for (const r of cleanMerges) {
  console.log(
    `  ${r.id}\tchr22:${r.start + 1}-${r.end}\t${r.nExons}ex ${r.strand}\t${r.mergedGenes.join(' + ')}\tgap ${r.gapBp}bp`,
  )
}

const structure = rows.filter(
  r => r.cls === 'structure-conflict' && r.nExons >= 4,
)
const novel = rows.filter(r => r.cls === 'novel-locus' && r.nExons >= 3)

console.log('\nstructure-conflict (>=4 exons):', structure.length)
console.log('novel-locus (>=3 exons):', novel.length)

const novelCoding = rows
  .filter(r => r.cls === 'novel-coding' && r.nExons >= 6)
  .sort((a, b) => b.nExons - a.nExons)
console.log('novel-coding (>=6 exons):', novelCoding.length)

const chosen = [
  ...cleanMerges.slice(0, 5),
  ...structure.slice(0, 3),
  ...novel.slice(0, 2),
  ...novelCoding.slice(0, 2),
]

const tally = {}
for (const r of rows)
  tally[r.cleanMerge ? 'merge (clean)' : r.cls] =
    (tally[r.cleanMerge ? 'merge (clean)' : r.cls] || 0) + 1
fs.writeFileSync(
  `${DIR}/tally.json`,
  JSON.stringify({ total: rows.length, tally }, null, 1),
)
console.log('\ntally', tally)

const out = chosen.map(r => {
  const pad = Math.max(3000, Math.round((r.end - r.start) * 0.15))
  const start = Math.max(1, r.start - pad)
  const end = r.end + pad
  return {
    id: r.id,
    cls: r.cleanMerge ? 'merge' : r.cls,
    loc: `chr22:${start}-${end}`,
    refName: 'chr22',
    start,
    end,
    strand: r.strand,
    nExons: r.nExons,
    span: r.span,
    mergedGenes: r.mergedGenes,
    gapBp: r.gapBp ?? null,
    touchedGenes: r.touchedGenes,
  }
})

fs.writeFileSync(`${DIR}/selected.json`, JSON.stringify(out, null, 1))
console.log('\nselected', out.length)
for (const c of out)
  console.log(' ', c.id, c.cls, c.loc, c.mergedGenes.join(' + ') || '-')
