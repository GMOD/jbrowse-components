import { defaultConfigs, defaultConfigUrl } from './default-configs.ts'
import { hostedConfigs } from './spec-recipe/hostedConfigs.generated.ts'

test.each(Object.entries(defaultConfigs))(
  '%s has a digest of its config with every trackId',
  (assembly, url) => {
    const digest = hostedConfigs[url]
    expect(digest?.assemblies?.map(a => a.name)).toContain(assembly)
    expect(digest?.allTrackIds?.length).toBeGreaterThan(0)
  },
)

test('an inherited property name is not an assembly', () => {
  expect(defaultConfigUrl('constructor')).toBeUndefined()
  expect(defaultConfigUrl('hg38')).toBe(defaultConfigs.hg38)
})
