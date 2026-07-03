import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './AllVsAllPAFAdapter.ts'
import configSchema from './configSchema.ts'

const paf = () => ({
  localPath: require.resolve('./test_data/all_vs_all.paf'),
  locationType: 'LocalPathLocation' as const,
})

function makeAdapter(
  assemblyNames: string[],
  assemblyNameToPanSN: Record<string, string> = {},
) {
  return new Adapter(
    configSchema.create({
      pafLocation: paf(),
      assemblyNames,
      assemblyNameToPanSN,
    }),
  )
}

const feats = (
  adapter: Adapter,
  region: Record<string, unknown>,
) => firstValueFrom(adapter.getFeatures(region as never).pipe(toArray()))

test('keeps only the queried pair (grape vs peach), dropping grape-cacao and grape-grape', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('refName')).toBe('chr1')
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'G1',
    assemblyName: 'peach',
  })
})

test('serves a direct non-reference pair present in the all-vs-all file (peach vs cacao)', async () => {
  const fa = await feats(makeAdapter(['peach', 'cacao']), {
    refName: 'G1',
    start: 0,
    end: 2000,
    assemblyName: 'peach',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({ refName: 'I', assemblyName: 'cacao' })
})

test('assemblyNameToPanSN maps JBrowse names to PanSN sample prefixes', async () => {
  const fa = await feats(
    makeAdapter(['grapeJB', 'peachJB'], { grapeJB: 'grape', peachJB: 'peach' }),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeJB' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate').assemblyName).toBe('peachJB')
})

test('getRefNames strips PanSN prefix and scopes to the assembly', async () => {
  const names = await makeAdapter(['grape', 'peach']).getRefNames({
    assemblyName: 'grape',
  })
  expect([...names].sort()).toEqual(['chr1', 'chr2'])
})
