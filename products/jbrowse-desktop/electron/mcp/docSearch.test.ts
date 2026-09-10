import { searchDocs } from './docSearch.ts'

import type { SearchableDoc } from './docSearch.ts'

const docs: SearchableDoc[] = [
  {
    topic: 'live-model',
    text: `# Guide\n\nintro line\n\n## Reading data\n\nuse jb.getFeatures for the colorBy of a track\n\n## Waiting\n\nnothing here\n`,
  },
  {
    topic: 'model:LinearAlignmentsDisplay',
    name: 'LinearAlignmentsDisplay',
    text: `# LinearAlignmentsDisplay (display model)\n\n## Actions\n\n- \`setColorScheme(c)\`: colorBy the reads\n`,
  },
  {
    topic: 'config:BamAdapter',
    name: 'BamAdapter',
    text: `# BamAdapter (config)\n\n## Slots\n\n- \`bamLocation\`: the file\n`,
  },
]

test('a type name outranks a mention of it', () => {
  const { text } = searchDocs(docs, 'LinearAlignmentsDisplay')
  expect(text).toContain('topic:"model:LinearAlignmentsDisplay"')
})

test('finds body text and names the section to read next', () => {
  const { text } = searchDocs(docs, 'colorBy')
  expect(text).toContain('topic:"live-model" section:"Reading data"')
  expect(text).toContain(
    'topic:"model:LinearAlignmentsDisplay" section:"Actions"',
  )
})

test('a heading match reports the heading, not every line under it', () => {
  const { text } = searchDocs(docs, 'Slots')
  expect(text).toContain('topic:"config:BamAdapter" section:"Slots"')
  expect(text).not.toContain('bamLocation')
})

// a page matched by name answers with the page, not with each line repeating it
test('does not also list the matched page body', () => {
  const { text } = searchDocs(docs, 'BamAdapter')
  expect(text).toContain('1 match')
})

// The bug this had on the day it shipped: the whole query was one substring,
// so any phrase an agent typed matched nothing. "synteny PAF track" is the
// query that found it.
test('scores each word of a phrase separately', () => {
  const { text, error } = searchDocs(docs, 'colorBy reads')
  expect(error).toBeUndefined()
  expect(text).toContain('topic:"model:LinearAlignmentsDisplay"')
})

test('ranks the line carrying most of the words first', () => {
  const { text } = searchDocs(docs, 'colorBy the reads')
  const first = text!.split('\n\n')[1]!
  expect(first).toContain('model:LinearAlignmentsDisplay')
})

test('a phrase says how it ordered rather than how many it found', () => {
  expect(searchDocs(docs, 'colorBy reads').text).toMatch(
    /carrying the most first/,
  )
  expect(searchDocs(docs, 'colorBy').text).not.toMatch(/carrying the most/)
})

// the whole phrase together beats the same words scattered
test('an exact phrase outranks the words apart', () => {
  const { text } = searchDocs(docs, 'colorBy the reads')
  expect(text!.split('\n\n')[1]).toContain('model:LinearAlignmentsDisplay')
})

// Grouping used to merge adjacent hits only, and the ranking sorts on score
// before topic — so a third page scoring between two hits of one section split
// them and printed its address twice, which is what the grouping exists to stop.
test('one section is one address however the ranking interleaves it', () => {
  const split: SearchableDoc[] = [
    {
      topic: 'live-model',
      text: '# Guide\n\n## Reading data\n\nthe colorBy setting and the reads it colours\nthe colorBy list\n',
    },
    {
      topic: 'config:BamAdapter',
      name: 'BamAdapter',
      text: '# BamAdapter\n\n## Slots\n\n- `colorBy the reads`: both words\n',
    },
  ]
  const { text } = searchDocs(split, 'colorBy reads')
  expect(
    text!.match(/topic:"live-model" section:"Reading data"/g),
  ).toHaveLength(1)
})

test('a miss says where else to look', () => {
  const { error } = searchDocs(docs, 'nosuchthing')
  expect(error).toMatch(/carries any word of/)
  expect(error).toMatch(/introspect it live/)
})

test('an empty search is refused', () => {
  expect(searchDocs(docs, '   ').error).toBeTruthy()
})
