import { describeLaunchLink } from './linkPrompt.ts'

const shortLink = 'https://jbrowse.org/code/jb2/latest/?config=none'

test('a short link is shown whole', () => {
  const { origin, displayUrl } = describeLaunchLink(shortLink)
  expect(origin).toBe('https://jbrowse.org')
  expect(displayUrl).toBe(shortLink)
})

// The reason this module exists: a real docs figure link runs to several
// thousand characters of percent-encoded session spec, and the dialog used to
// show every one of them.
test('a spec link is cut down, and says how much was cut', () => {
  const link = `https://jbrowse.org/code/jb2/main/?config=https%3A%2F%2Fjbrowse.org%2Fdemos%2Fcancer_sv%2Fconfig.json&session=spec-${'%22'.repeat(2000)}`
  const { displayUrl } = describeLaunchLink(link)

  expect(displayUrl.length).toBeLessThan(300)
  expect(displayUrl).toContain(`${link.length} characters in all`)
  // the informative prefix survives the cut: the user can still see where the
  // link points and which config it loads
  expect(displayUrl).toContain('https://jbrowse.org/code/jb2/main/')
  expect(displayUrl).toContain('config=https%3A%2F%2Fjbrowse.org')
})

test('the origin is what the dialog leads with', () => {
  expect(
    describeLaunchLink('https://example.com:8080/jb2/?config=x').origin,
  ).toBe('https://example.com:8080')
})

// parseProtocolUrl only ever hands over an http(s) url, so this is a
// belt-and-braces case — but it is fed OS-delivered input, and returning
// undefined lets the caller word the prompt without an origin rather than
// printing "null" at the user.
test('a url that does not parse has no origin, and is still shown', () => {
  const { origin, displayUrl } = describeLaunchLink('not a url')
  expect(origin).toBeUndefined()
  expect(displayUrl).toBe('not a url')
})
