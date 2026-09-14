import { unpromptedTags } from './figure-actions.ts'

const page = (body: string) => `---\ntitle: x\n---\n\n${body}\n`

test('a figure under a heading with no instruction is unprompted', () => {
  const text = page(
    '## The locus\n\nThe graph holds the swap as an object.\n\n<Figure src="/img/a.png" />',
  )
  expect(unpromptedTags(text)).toEqual([{ line: 9, tag: 'Figure' }])
})

test('a location string, a menu path or a click before the tag prompts it', () => {
  for (const action of [
    'Type `chr6:32,500,000-32,560,000` into the location box.',
    'Open the track menu and pick **Launch → Graph genome view (this region)**.',
    'Right-click the ringed node.',
    'The pane opens. Click the label.',
  ]) {
    const text = page(`## Cut\n\n${action}\n\n<Video src="/media/a.mp4" />`)
    expect(unpromptedTags(text)).toEqual([])
  }
})

test('a config or command fence before the tag prompts it', () => {
  for (const fence of ['json addtrack', 'json session config=x', 'bash']) {
    const text = page(
      `## Add it\n\n\`\`\`${fence}\n{}\n\`\`\`\n\n<Figure src="/img/a.png" />`,
    )
    expect(unpromptedTags(text)).toEqual([])
  }
})

test('an instruction inside a code fence or a caption does not count', () => {
  const text = page(
    '## Read\n\n```\nType `chr1:1-2`\n```\n\n<Figure caption="Click the node at chr1:1-2" src="/img/a.png" />',
  )
  expect(unpromptedTags(text)).toHaveLength(1)
})

test("a new section forgets the previous section's instruction", () => {
  const text = page(
    '## One\n\nType `chr1:1-100`.\n\n<Figure src="/img/a.png" />\n\n## Two\n\nThe result.\n\n<Figure src="/img/b.png" />',
  )
  expect(unpromptedTags(text).map(t => t.line)).toEqual([15])
})
