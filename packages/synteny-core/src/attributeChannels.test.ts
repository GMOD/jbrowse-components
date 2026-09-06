import { SimpleFeature } from '@jbrowse/core/util'

import {
  createAttributeChannels,
  writeFeatureAttribute,
} from './attributeChannels.ts'

function feature(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: String(Math.random()),
    refName: 'chr1',
    start: 0,
    end: 1,
    ...data,
  })
}

function fill(name: string, rows: Record<string, unknown>[]) {
  const channels = createAttributeChannels([name], rows.length)
  const channel = channels.list[0]!
  rows.forEach((row, i) => {
    writeFeatureAttribute(channel, i, feature(row))
  })
  return channels.finish(rows.length)
}

test('a numeric column reports its span, missing as -1', () => {
  const { attributes, attributeRanges } = fill('dn', [
    { dn: 0.5 },
    {},
    { dn: 2 },
  ])
  expect(Array.from(attributes.dn!)).toEqual([0.5, -1, 2])
  expect(attributeRanges.dn).toEqual({ min: 0.5, max: 2 })
})

// The label list is the fetch's own dictionary: a feature's channel value
// indexes it, and the file's color rides beside the label it was seen with.
test('a text column interns labels in first-seen order and keeps the file color', () => {
  const { attributes, attributeRanges } = fill('group', [
    { group: 'B1', color: '#2F54E3' },
    { group: 'A1a' },
    {},
    { group: 'B1', color: '#000000' },
    { group: 'A1a', color: '#4DB5E3' },
  ])
  expect(Array.from(attributes.group!)).toEqual([0, 1, -1, 0, 1])
  expect(attributeRanges.group).toEqual({
    labels: ['B1', 'A1a'],
    colors: { B1: '#2F54E3', A1a: '#4DB5E3' },
  })
})

// A column is numeric until text turns up in it. The numbers already written
// would otherwise be read as label indices, so they become labels themselves.
test('numbers seen before the first label become labels of their own', () => {
  const { attributes, attributeRanges } = fill('group', [
    { group: 7 },
    {},
    { group: 'x' },
    { group: 7 },
    { group: 3 },
  ])
  expect(Array.from(attributes.group!)).toEqual([0, -1, 1, 0, 2])
  expect(attributeRanges.group).toEqual({
    labels: ['7', 'x', '3'],
    colors: {},
  })
})
