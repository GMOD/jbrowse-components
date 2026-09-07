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

test('a miss says where else to look', () => {
  const { error } = searchDocs(docs, 'nosuchthing')
  expect(error).toMatch(/Nothing in the bundled documentation/)
  expect(error).toMatch(/introspect it live/)
})

test('an empty search is refused', () => {
  expect(searchDocs(docs, '   ').error).toBeTruthy()
})
