import fs from 'node:fs'

import { liveUrl } from './capture.mjs'

const DIR =
  '/tmp/claude-1001/-home-cdiesh-src-jbrowse-components/262270f7-1cc8-4aa7-87fe-681ca886d010/scratchpad/tib'
const OUT =
  '/home/cdiesh/src/jbrowse-components/.claude/worktrees/tiberius-review-demo/demo/tiberius-review.html'

const selected = JSON.parse(fs.readFileSync(`${DIR}/selected.json`, 'utf8'))
const tally = JSON.parse(fs.readFileSync(`${DIR}/tally.json`, 'utf8'))

const CLASSES = {
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
}

const cards = selected.map(c => {
  const png = fs.readFileSync(`${DIR}/img/web/${c.id}.png`)
  return {
    id: c.id,
    cls: c.cls,
    loc: c.loc,
    nExons: c.nExons,
    strand: c.strand,
    spanKb: Math.round(c.span / 100) / 10,
    genes: c.mergedGenes?.length ? c.mergedGenes : c.touchedGenes.slice(0, 3),
    gapBp: c.gapBp,
    url: liveUrl(c),
    img: `data:image/png;base64,${png.toString('base64')}`,
  }
})

const data = {
  assembly: 'hg38',
  region: 'chr22',
  tally: tally.tally,
  total: tally.total,
  agrees: tally.tally.agrees,
  flagged: tally.total - tally.tally.agrees,
  classes: CLASSES,
  cards,
}

const template = fs.readFileSync(`${DIR}/template.html`, 'utf8')
fs.mkdirSync(OUT.replace(/\/[^/]+$/, ''), { recursive: true })
fs.writeFileSync(OUT, template.replace('"__DATA__"', JSON.stringify(data)))
console.log('wrote', OUT, `${Math.round(fs.statSync(OUT).size / 1024)} KB`)
