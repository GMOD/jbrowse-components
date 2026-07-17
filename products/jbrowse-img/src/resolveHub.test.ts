import { hubUrl } from '@jbrowse/core/util/fetchHub'

test('UCSC db name maps to the /ucsc config', () => {
  expect(hubUrl('hg19')).toBe(
    'https://jbrowse.org/ucsc/hg19/config.json',
  )
  expect(hubUrl('mm10')).toBe(
    'https://jbrowse.org/ucsc/mm10/config.json',
  )
})

test('GenArk accession splits into triplets under /hubs/genark', () => {
  expect(hubUrl('GCA_964188535.1')).toBe(
    'https://jbrowse.org/hubs/genark/GCA/964/188/535/GCA_964188535.1/config.json',
  )
  expect(hubUrl('GCF_000001405.40')).toBe(
    'https://jbrowse.org/hubs/genark/GCF/000/001/405/GCF_000001405.40/config.json',
  )
})
