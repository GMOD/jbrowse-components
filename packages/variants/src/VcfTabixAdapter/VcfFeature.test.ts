import VcfParser from '@gmod/vcf'
import VcfFeature from './VcfFeature'

test('test usage of the VcfFeature', async () => {
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
