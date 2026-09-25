import { unshownSettings } from './unshown-settings.ts'

const page = (body: string) => `---\ntitle: x\n---\n\n${body}\n`

test('a menu path with no figure after it is unshown', () => {
  const text = page(
    '## Color the reads\n\nSet **Color by... → Modifications** from the track menu.',
  )
  expect(unshownSettings(text)).toEqual([
    { line: 7, path: 'Color by... → Modifications' },
  ])
})

test('a figure in the section, or the one after it, shows the setting', () => {
  for (const tail of [
    '\n<Figure src="/img/a.png" />',
    '\n## Reading it\n\n<Figure src="/img/a.png" />',
    '\n## Reading it\n\n<Video src="/media/a.mp4" />',
  ]) {
    const text = page(
      `## Color\n\nSet **Color by... → Modifications**.\n${tail}`,
    )
    expect(unshownSettings(text)).toEqual([])
  }
})

test('two sections on is too far', () => {
  const text = page(
    '## Color\n\nSet **Color by... → Modifications**.\n\n## Then\n\ntext\n\n## Later\n\n<Figure src="/img/a.png" />',
  )
  expect(unshownSettings(text)).toHaveLength(1)
})

test('a figure BEFORE the setting shows something else', () => {
  const text = page(
    '## Copy number\n\nOpen it.\n\n<Figure src="/img/a.png" />\n\nThen **Clustering → Cluster rows by similarity** reorders them.',
  )
  expect(unshownSettings(text)).toHaveLength(1)
})

test('opening a file or installing a plugin draws nothing of its own', () => {
  for (const plumbing of [
    'Choose **File → Session → Open JBrowse Web link**.',
    'The start screen at **Global plugins... → Add custom plugin** takes the URL.',
  ]) {
    expect(unshownSettings(page(`## Set up\n\n${plumbing}`))).toEqual([])
  }
})

test('a menu path inside a fence, or past See also, is not an instruction', () => {
  const fenced = page(
    '## Color\n\n```text\n**Color by... → Modifications**\n```',
  )
  expect(unshownSettings(fenced)).toEqual([])
  const tail = page('## See also\n\n- **Color by... → Modifications**')
  expect(unshownSettings(tail)).toEqual([])
})
