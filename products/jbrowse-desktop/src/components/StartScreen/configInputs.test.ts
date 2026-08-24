import { completeConfig, mergeConfigInputs } from './configInputs.ts'

test('completeConfig supplies the list fields an input need not carry', () => {
  const config = completeConfig({})
  expect(config.assemblies).toEqual([])
  expect(config.tracks).toEqual([])
  expect(config.internetAccounts.map(a => a.internetAccountId)).toEqual([
    'dropboxOAuth',
    'googleOAuth',
  ])
})

test('a config declaring one of the built-in account ids wins', () => {
  const { internetAccounts } = completeConfig({
    internetAccounts: [
      {
        type: 'DropboxOAuthInternetAccount',
        internetAccountId: 'dropboxOAuth',
        name: 'Our Dropbox',
        description: '',
        clientId: 'site-specific',
      },
    ],
  })
  expect(
    internetAccounts.filter(a => a.internetAccountId === 'dropboxOAuth'),
  ).toHaveLength(1)
  expect(internetAccounts[0]?.clientId).toBe('site-specific')
})

test('completeConfig dedupes assemblies by name and tracks by trackId', () => {
  const config = completeConfig({
    assemblies: [{ name: 'hg38' }, { name: 'hg38' }, { name: 'mm10' }],
    tracks: [{ trackId: 't1' }, { trackId: 't1' }],
  })
  expect(config.assemblies).toEqual([{ name: 'hg38' }, { name: 'mm10' }])
  expect(config.tracks).toEqual([{ trackId: 't1' }])
})

test('completeConfig keeps the fields it does not own', () => {
  expect(
    completeConfig({ defaultSession: { name: 'sess' }, plugins: [] })
      .defaultSession,
  ).toEqual({ name: 'sess' })
})

test('mergeConfigInputs unions the catalogs across entries', () => {
  const merged = mergeConfigInputs([
    { assemblies: [{ name: 'hg38' }], tracks: [{ trackId: 'a' }] },
    { assemblies: [{ name: 'mm10' }], tracks: [{ trackId: 'b' }] },
  ])
  expect(merged.assemblies).toEqual([{ name: 'hg38' }, { name: 'mm10' }])
  expect(merged.tracks).toEqual([{ trackId: 'a' }, { trackId: 'b' }])
})

test('defaultSession is the first entry, never a merge of every entry', () => {
  const merged = mergeConfigInputs([
    { defaultSession: { name: 'first', views: [{ id: 'v1' }] } },
    { defaultSession: { name: 'second', views: [{ id: 'v2' }] } },
  ])
  expect(merged.defaultSession).toEqual({
    name: 'first',
    views: [{ id: 'v1' }],
  })
})

test('one entry keeps its sourceConfigUrl, several drop it', () => {
  const one = { configuration: { sourceConfigUrl: 'https://h/config.json' } }
  expect(mergeConfigInputs([one]).configuration).toEqual({
    sourceConfigUrl: 'https://h/config.json',
  })
  expect(mergeConfigInputs([one, one]).configuration).toEqual({
    sourceConfigUrl: '',
  })
})

test('configuration merges across entries, later entries winning', () => {
  expect(
    mergeConfigInputs([
      { configuration: { theme: { palette: { primary: 'blue' } } } },
      { configuration: { theme: { palette: { secondary: 'red' } } } },
    ]).configuration,
  ).toEqual({
    theme: { palette: { primary: 'blue', secondary: 'red' } },
    sourceConfigUrl: '',
  })
})

test('no entry carrying a configuration leaves it absent', () => {
  expect(mergeConfigInputs([{}, {}]).configuration).toBeUndefined()
})

test('merging then completing is what the launch path does', () => {
  const config = completeConfig(
    mergeConfigInputs([
      { assemblies: [{ name: 'hg38' }] },
      { assemblies: [{ name: 'hg38' }, { name: 'mm10' }] },
    ]),
  )
  expect(config.assemblies).toEqual([{ name: 'hg38' }, { name: 'mm10' }])
})
