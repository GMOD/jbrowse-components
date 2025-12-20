import { guessAdapter as guessAdapter2 } from '@jbrowse/core/util/tracks'
import { createTestSession } from '@jbrowse/web/src/rootModel'

jest.mock('../makeWorkerInstance', () => () => {})

function makeLoc(uri: string) {
  return {
    locationType: 'UriLocation',
    uri,
  } as const
}

const session = createTestSession()

export function guessAdapter({
  file,
  index,
  hint,
}: {
  file: string
  index?: string
  hint?: string
}) {
  return guessAdapter2(
    makeLoc(file),
    index ? makeLoc(index) : undefined,
    hint,
    session,
  )
}

function check(arg: { file: string; index?: string; hint?: string }) {
  expect(guessAdapter(arg)).toMatchSnapshot()
}

test('file types', () => {
  check({ file: 'test.txt', hint: 'BedAdapter' })
  check({ file: 'test.bb' })
  check({ file: 'test.bigbed' })
  check({ file: 'test.bigbed', hint: 'BigBedAdapter' })
  check({ file: 'test.txt', hint: 'BigBedAdapter' })
  check({ file: 'test.paf' })
  check({ file: 'test.paf.gz' })
  check({ file: 'test.chain' })
  check({ file: 'test.chain.gz' })
  check({ file: 'test.delta' })
  check({ file: 'test.delta.gz' })
  check({ file: 'test.out' })
  check({ file: 'test.out.gz' })
  check({ file: 'test.pif.gz' })
  check({ file: 'test.pif.gz', index: 'test.pif.gz.csi' })
  check({ file: 'test.pif' })
  check({ file: 'test.gtf' })
  check({ file: 'test.gtf.gz' })
  check({ file: 'test.gff.gz' })
  check({ file: 'test.gff3.gz' })
  check({ file: 'test.gff2' })
  check({ file: 'test.bw' })
  check({ file: 'test.bigwig' })
  check({ file: 'test.hic' })
  check({ file: 'test.anchors' })
  check({ file: 'test.anchors.simple' })
  check({ file: 'test.vcf' })
  check({ file: 'test.vcf.gz' })
  check({ file: 'test.vcf.gz', index: 'test.vcf.gz.csi' })
  check({ file: 'test.bedMethyl' })
  check({ file: 'test.bedMethyl', hint: 'BedAdapter' })
  check({ file: 'test.bg' })
  check({ file: 'test.bg.gz' })
  check({ file: 'test.bedpe' })
  check({ file: 'test.tab', hint: 'BlastTabularAdapter' })
  check({ file: 'test.anchors' })
  check({ file: 'test.anchors.gz' })
  check({ file: 'test.anchors.simple' })
  check({ file: 'test.anchors.simple.gz' })
})
