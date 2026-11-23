import { describeLaunchLink } from './linkPrompt.ts'

const page = 'https://jbrowse.org/code/jb2/main/'
const spec = `spec-${encodeURIComponent(JSON.stringify({ views: [] }))}`

test('a short link is shown whole', () => {
  const link = `${page}?config=none&session=${spec}`
  expect(describeLaunchLink(link).displayUrl).toBe(link)
})

// The reason the cut exists: a real docs figure link runs to several thousand
// characters of percent-encoded session spec, and the dialog used to show every
// one of them.
test('a spec link is cut down, and says how much was cut', () => {
  const link = `${page}?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fcancer_sv%2Fconfig.json&session=spec-${'%22'.repeat(2000)}`
  const { displayUrl } = describeLaunchLink(link)

  expect(displayUrl.length).toBeLessThan(300)
  expect(displayUrl).toContain(`${link.length} characters in all`)
})

// The page a link points at is chosen by whoever wrote the link, and is never
// contacted when the config is elsewhere, so naming it would vouch for a
// session it has nothing to do with.
test('the dialog names where the config comes from, not the page', () => {
  const link = `${page}?session=${spec}${'%20'.repeat(500)}&config=https%3A%2F%2Fevil.example%2Fconfig.json`
  expect(describeLaunchLink(link)).toMatchObject({
    origin: 'https://evil.example',
    configUrl: 'https://evil.example/config.json',
  })
})

test('a link carrying its own data names no origin', () => {
  expect(
    describeLaunchLink(`${page}?config=none&session=${spec}`).origin,
  ).toBeUndefined()
})

test('a url that does not parse has no origin, and is still shown', () => {
  const { origin, displayUrl } = describeLaunchLink('not a url')
  expect(origin).toBeUndefined()
  expect(displayUrl).toBe('not a url')
})

test.each([
  'file://fileserver/share/config.json',
  'file:///home/u/config.json',
  'smb://fileserver/share/config.json',
])('a link whose config is not on the web is refused: %s', configUrl => {
  const link = `${page}?config=${encodeURIComponent(configUrl)}&session=${spec}`
  expect(describeLaunchLink(link).refusal).toContain(configUrl)
})

test('a link whose config is on the web is not refused', () => {
  expect(
    describeLaunchLink(`${page}?config=test_data/volvox/config.json`).refusal,
  ).toBeUndefined()
})
