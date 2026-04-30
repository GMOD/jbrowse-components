import { TabixIndexedFile } from '@gmod/tabix'
import { LocalFile } from 'generic-filehandle2'
import {
  parsePosLineOrdinals,
  mergeOrdinalRanges,
  getSegmentsForOrdinalsFromShard,
  orientChar,
} from '/home/cdiesh/src/jbrowse-components/plugins/comparative-adapters/src/GfaTabixAdapter/gfaBinaryIO.ts'

const prefix = '/home/cdiesh/src/jbrowse-components/test_data/volvox/volvox_pangenome_50'
const pos = new TabixIndexedFile({
  filehandle: new LocalFile(prefix + '.pos.bed.gz'),
  tbiFilehandle: new LocalFile(prefix + '.pos.bed.gz.tbi'),
})
const seg = {
  filehandle: new LocalFile(prefix + '.segments.bin'),
  idxFile: new LocalFile(prefix + '.segments.idx'),
}
const header = await pos.getHeader()
const m = /paths=([^\n]+)/.exec(header)!
const paths = m[1]!.split(',')
const refIdx = paths.indexOf('ref#0#ctgA')
const sample01Idx = paths.indexOf('sample01#0#ctgA')

const ranges: [number, number][] = []
await pos.getLines('ref#0#ctgA', 5000, 6000, {
  lineCallback: (line: string) => parsePosLineOrdinals(line, ranges),
})
const merged = mergeOrdinalRanges(ranges)
const segs = await getSegmentsForOrdinalsFromShard(seg, merged)

console.log('ref ord ranges in 5000-6000:', merged)
console.log()
console.log('ref records:')
for (const r of segs.filter(r => r.pathNameIdx === refIdx)) {
  console.log(`  ord=${r.segOrd} offset=${r.offset} len=${r.segLen} orient=${orientChar(r.orient)}`)
}
console.log()
console.log('sample01 records (in same ord range):')
for (const r of segs.filter(r => r.pathNameIdx === sample01Idx).sort((a,b) => a.offset - b.offset)) {
  console.log(`  ord=${r.segOrd} offset=${r.offset} len=${r.segLen} orient=${orientChar(r.orient)}`)
}
