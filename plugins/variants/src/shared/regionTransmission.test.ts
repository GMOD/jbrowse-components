import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'

import { variantCellData } from '../VariantRPC/executeVariantCellData.ts'
import VariantsPlugin from '../index.ts'
import { transmissionArg } from './regionTransmission.ts'

const ALIASES: Record<string, string> = {
  'nc_000023.11': 'chrX',
  x: 'chrX',
  'nc_000001.11': 'chr1',
  mt: 'chrM',
}
const hg38 = {
  getCanonicalRefName2: (refName: string) =>
    ALIASES[refName.toLowerCase()] ?? refName,
}
const X_ENTRY = { refName: 'chrX', sex: 'male', from: 'mother' } as const
const Y_ENTRY = { refName: 'chrY', sex: 'male', from: 'father' } as const
const M_ENTRY = { refName: 'MT', from: 'either' } as const
const ENTRIES = [X_ENTRY, Y_ENTRY, M_ENTRY]
const TRIO = [{ child: 'kid', father: 'dad', mother: 'mom', sex: 'male' }]

function region(refName: string, assemblyName = 'hg38') {
  return { assemblyName, refName, start: 0, end: 1000 }
}

function argFor(
  regions: ReturnType<typeof region>[],
  trios: readonly unknown[] = TRIO,
) {
  return transmissionArg({
    trios,
    entries: ENTRIES,
    regions,
    assemblyOf: name => (name === 'hg38' ? hg38 : undefined),
  })
}

test('each region takes the entries its contig resolves to, in the order the regions come', () => {
  expect(argFor([region('chrX'), region('chr1'), region('chrM')])).toEqual([
    [X_ENTRY],
    [],
    [M_ENTRY],
  ])
  expect(argFor([region('chrM'), region('chrX'), region('chr1')])).toEqual([
    [M_ENTRY],
    [X_ENTRY],
    [],
  ])
})

test('a region spelled by an alias takes its canonical contig’s entries', () => {
  expect(argFor([region('chr1'), region('NC_000023.11')])).toEqual([
    [],
    [X_ENTRY],
  ])
})

test('two regions on one contig each carry its entries', () => {
  expect(argFor([region('chrX'), region('chr1'), region('chrX')])).toEqual([
    [X_ENTRY],
    [],
    [X_ENTRY],
  ])
})

test('a region on an assembly no one knows takes the autosomal rule', () => {
  expect(argFor([region('chrX', 'unknown'), region('chrX')])).toEqual([
    [],
    [X_ENTRY],
  ])
})

test('no trio sends no transmission at all', () => {
  expect(argFor([region('chrX')], [])).toBeUndefined()
})

// trio_x.vcf writes chrX as NC_000023.11; x1 is a son's 1/1 from a 0/0
// father and a 0/1 mother, consistent only under the X entry
test('the rules reach the worker keyed by the file’s spelling of each region', async () => {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  const viewRegions = [region('chr1'), region('chrX')]
  const renamed = [
    { ...viewRegions[0]!, refName: 'NC_000001.11' },
    { ...viewRegions[1]!, refName: 'NC_000023.11' },
  ]
  const result = await variantCellData({
    pluginManager,
    args: {
      sessionId: 'regionTransmission',
      adapterConfig: {
        type: 'VcfAdapter',
        vcfLocation: {
          localPath: require.resolve('../VcfAdapter/test_data/trio_x.vcf'),
          locationType: 'LocalPathLocation',
        },
      },
      regions: renamed,
      siteFilter: [],
      rowsField: 'sample',
      layout: 'genomic',
      trios: [{ child: 'kid', father: 'dad', mother: 'mom', sex: 'male' }],
      transmission: argFor(viewRegions),
    },
  })
  if (isRegionRefused(result)) {
    throw new Error('refused')
  }
  const x1 = Object.values(result.value.perRegionCellData)
    .flatMap(data => data.featureInfo)
    .find(info => info.name === 'x1')

  expect(x1?.mendelian).toBe('consistent')
})
