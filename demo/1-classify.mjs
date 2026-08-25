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

function readGff(path) {
  return fs
    .readFileSync(path, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const f = l.split('\t')
      return {
        refName: f[0],
        type: f[2],
        start: +f[3] - 1,
        end: +f[4],
        strand: f[6],
        attrs: attrs(f[8] || ''),
      }
    })
}

const overlaps = (a, b) => a.start < b.end && b.start < a.end

const gencodeAll = readGff(`${DIR}/gencode_chr22_all.gff`)
const gencodeGenes = gencodeAll.filter(f => f.type === 'gene')
const gname = g => g.attrs.gene_name || g.attrs.gene_id

// exons keyed by their gene, so overlap is measured against exons and not spans
const gcExonsByGene = new Map()
for (const e of gencodeAll) {
  if (e.type !== 'exon') continue
  const n = e.attrs.gene_name || e.attrs.gene_id
  if (!gcExonsByGene.has(n)) gcExonsByGene.set(n, [])
  gcExonsByGene.get(n).push(e)
}

const geneByName = new Map()
for (const g of gencodeGenes)
  if (!geneByName.has(gname(g))) geneByName.set(gname(g), g)

const tibAll = readGff(`${DIR}/tib_chr22_all.gff`)
const tibTx = tibAll.filter(f => f.type === 'transcript')
const tibExons = new Map()
for (const e of tibAll) {
  if (e.type !== 'exon') continue
  const p = e.attrs.Parent
  if (!tibExons.has(p)) tibExons.set(p, [])
  tibExons.get(p).push(e)
}

function junctions(exons) {
  const s = [...exons].sort((x, y) => x.start - y.start)
  const j = []
  for (let i = 0; i < s.length - 1; i++) j.push(`${s[i].end}-${s[i + 1].start}`)
  return new Set(j)
}

const rows = []
for (const t of tibTx) {
  const exons = tibExons.get(t.attrs.ID) || []

  // Genes whose EXONS the prediction actually touches. A gene nested in another
  // gene's intron shares no exon, which is what span overlap got wrong.
  const touched = []
  for (const g of gencodeGenes) {
    if (!overlaps(t, g)) continue
    const ge = gcExonsByGene.get(gname(g)) || []
    if (exons.some(te => ge.some(e => overlaps(te, e)))) touched.push(g)
  }

  // Only a same-strand coding gene can be part of a merged model.
  const sameStrandCoding = [
    ...new Set(
      touched
        .filter(
          g => g.attrs.gene_type === 'protein_coding' && g.strand === t.strand,
        )
        .map(gname),
    ),
  ]

  const tj = junctions(exons)
  let cls
  if (touched.length === 0) cls = 'novel-locus'
  else if (sameStrandCoding.length === 0) cls = 'novel-coding'
  else if (sameStrandCoding.length > 1) cls = 'merge'
  else {
    const gj = junctions(gcExonsByGene.get(sameStrandCoding[0]) || [])
    const shared = [...tj].filter(x => gj.has(x)).length
    cls = tj.size > 1 && shared === 0 ? 'structure-conflict' : 'agrees'
  }

  rows.push({
    id: t.attrs.ID,
    refName: t.refName,
    start: t.start,
    end: t.end,
    strand: t.strand,
    span: t.end - t.start,
    nExons: exons.length,
    cls,
    mergedGenes: sameStrandCoding,
    touchedGenes: [
      ...new Set(
        touched.map(g => `${gname(g)}(${g.strand},${g.attrs.gene_type})`),
      ),
    ],
  })
}

const tally = {}
for (const r of rows) tally[r.cls] = (tally[r.cls] || 0) + 1
console.log('chr22 Tiberius transcripts:', rows.length)
console.log(tally)

fs.writeFileSync(`${DIR}/candidates2.json`, JSON.stringify(rows, null, 1))

console.log('\n--- merges (exon-level, same strand) ---')
for (const r of rows
  .filter(r => r.cls === 'merge')
  .sort((a, b) => b.nExons - a.nExons)
  .slice(0, 12)) {
  console.log(
    `${r.id}\t${r.refName}:${r.start + 1}-${r.end}\t${r.nExons}ex ${r.strand}\t${r.mergedGenes.join(' + ')}`,
  )
}
console.log('\n--- novel loci ---')
for (const r of rows
  .filter(r => r.cls === 'novel-locus' && r.nExons >= 2)
  .sort((a, b) => b.nExons - a.nExons)
  .slice(0, 8)) {
  console.log(
    `${r.id}\t${r.refName}:${r.start + 1}-${r.end}\t${r.nExons}ex ${r.strand}`,
  )
}
console.log('\n--- structure conflicts ---')
for (const r of rows
  .filter(r => r.cls === 'structure-conflict')
  .sort((a, b) => b.nExons - a.nExons)
  .slice(0, 8)) {
  console.log(
    `${r.id}\t${r.refName}:${r.start + 1}-${r.end}\t${r.nExons}ex ${r.strand}\t${r.mergedGenes.join(',')}`,
  )
}
