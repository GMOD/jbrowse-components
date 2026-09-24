import { ConfigurationSchema } from '../configuration/index.ts'
import { assemblyConfByName } from './assemblyConfByName.ts'

const schema = ConfigurationSchema('TestAssembly', {
  name: { type: 'string', defaultValue: '' },
  aliases: { type: 'stringArray', defaultValue: [] },
})

test('finds an assembly config by its name or one of its aliases', () => {
  const hg38 = schema.create({ name: 'hg38', aliases: ['GRCh38'] })
  const assemblyManager = {
    assemblyList: [schema.create({ name: 'volvox' }), hg38],
  }
  expect(assemblyConfByName(assemblyManager, 'hg38')).toBe(hg38)
  expect(assemblyConfByName(assemblyManager, 'GRCh38')).toBe(hg38)
  expect(assemblyConfByName(assemblyManager, 'mm10')).toBeUndefined()
})
