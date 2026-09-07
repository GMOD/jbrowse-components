import { hostedConfigUrl } from './hostedConfig.ts'

test('names the UCSC config for a database name', () => {
  expect(hostedConfigUrl('hg38')).toBe(
    'https://jbrowse.org/ucsc/hg38/config.json',
  )
  expect(hostedConfigUrl('danRer11')).toBe(
    'https://jbrowse.org/ucsc/danRer11/config.json',
  )
  expect(hostedConfigUrl('hs1')).toBe(
    'https://jbrowse.org/ucsc/hs1/config.json',
  )
})

// the accession's first nine digits fan into three directories
test('fans a GenArk accession into its hub path', () => {
  expect(hostedConfigUrl('GCA_964188535.1')).toBe(
    'https://jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json',
  )
  expect(hostedConfigUrl('GCF_040938575.1')).toBe(
    'https://jbrowse.org/hubs/genark/GCF/040/938/575/GCF_040938575.1/config.json',
  )
})

test('says nothing about a path', () => {
  expect(hostedConfigUrl('config.json')).toBeUndefined()
  expect(hostedConfigUrl('data/config.json')).toBeUndefined()
  expect(hostedConfigUrl('./session.jbrowse')).toBeUndefined()
  expect(hostedConfigUrl('GCA_96418.1')).toBeUndefined()
})
