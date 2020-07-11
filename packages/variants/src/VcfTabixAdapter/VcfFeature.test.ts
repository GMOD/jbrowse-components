import VcfParser from '@gmod/vcf'
import VcfFeature from './VcfFeature'

test('test usage of the VcfFeature', () => {
  const parser = new VcfParser({
    header: `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tBAMs/caudaus.sorted.sam`,
  })
  const line = `lcl|Scaffald_1\t80465\trs118266897\tR\tA\t29\tPASS\tNS=3;0,14;AF=0.5;DB;112;PG2.1`

  const variant = parser.parseLine(line)

  const f = new VcfFeature({
    parser,
    variant,
    id: 'myuniqueid',
  })
  expect(f.id()).toEqual('myuniqueid')
  expect(f.get('name')).toEqual('rs118266897')
})

test('try INS feature with END less than start', () => {
  const parser = new VcfParser({
    header: `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tBAMs/caudaus.sorted.sam`,
  })
  const line = `chr1\t100\trs123\tR\tA\t29\tPASS\tEND=1;SVTYPE=INS`

  const variant = parser.parseLine(line)

  const f = new VcfFeature({
    parser,
    variant,
    id: 'myuniqueid',
  })
  expect(f.id()).toEqual('myuniqueid')
  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(100)
})

test('try DEL feature with END info field valid', () => {
  const parser = new VcfParser({
    header: `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tBAMs/caudaus.sorted.sam`,
  })
  const line = `chr1\t100\trs123\tR\t<DEL>\t29\tPASS\tEND=1000;SVTYPE=DEL`

  const variant = parser.parseLine(line)

  const f = new VcfFeature({
    parser,
    variant,
    id: 'myuniqueid',
  })
  expect(f.id()).toEqual('myuniqueid')
  expect(f.get('start')).toEqual(99)
  expect(f.get('end')).toEqual(1000)
})
