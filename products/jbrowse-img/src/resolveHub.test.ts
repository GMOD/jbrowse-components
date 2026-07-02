import { hubToConfigUrl } from './resolveHub.ts'

test('UCSC db name maps to the /ucsc config', () => {
  expect(hubToConfigUrl('hg19')).toBe(
    'https://jbrowse.org/ucsc/hg19/config.json',
  )
  expect(hubToConfigUrl('mm10')).toBe(
    'https://jbrowse.org/ucsc/mm10/config.json',
  )
})

test('GenArk accession splits into triplets under /hubs/genark', () => {
  expect(hubToConfigUrl('GCA_964188535.1')).toBe(
    'https://jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json',
  )
  expect(hubToConfigUrl('GCF_000001405.40')).toBe(
    'https://jbrowse.org/hubs/genark/GCF/000/001/405/GCF_000001405.40/config.json',
  )
})
