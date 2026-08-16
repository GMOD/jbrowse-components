import {
  isAppUrl,
  isOAuthRedirect,
  isSafeExternalUrl,
} from './navigationGuard.ts'

const packaged = 'file:///opt/JBrowse/resources/app/index.html'
const dev = 'http://localhost:3000/'

describe('isAppUrl', () => {
  test('the app itself is allowed', () => {
    expect(isAppUrl(packaged, packaged)).toBe(true)
    expect(isAppUrl(dev, dev)).toBe(true)
  })

  // buildAppUrl varies these per launch, so they must not make it a stranger
  test('the app with different launch params is still the app', () => {
    expect(isAppUrl(`${packaged}?config=/x/session.jbrowse`, packaged)).toBe(
      true,
    )
    expect(isAppUrl(`${packaged}?renderer=webgl#hash`, packaged)).toBe(true)
    expect(isAppUrl(`${dev}?specLink=https%3A%2F%2Fjbrowse.org`, dev)).toBe(
      true,
    )
  })

  test('remote pages are refused', () => {
    expect(isAppUrl('https://evil.example/', packaged)).toBe(false)
    expect(isAppUrl('https://evil.example/', dev)).toBe(false)
    // a lookalike host must not pass for the dev server
    expect(isAppUrl('http://localhost:4000/', dev)).toBe(false)
    expect(isAppUrl('http://notlocalhost:3000/', dev)).toBe(false)
  })

  // the reason this compares piecewise instead of by origin: every file:// url
  // shares the opaque "null" origin, so an origin check would pass all of these
  test('other local files are refused from the packaged app', () => {
    expect(isAppUrl('file:///etc/passwd', packaged)).toBe(false)
    expect(isAppUrl('file:///home/u/Downloads/evil.html', packaged)).toBe(false)
    expect(
      isAppUrl('file:///opt/JBrowse/resources/app/other.html', packaged),
    ).toBe(false)
  })

  test('non-http schemes a page could try are refused', () => {
    expect(isAppUrl('javascript:require("child_process")', packaged)).toBe(
      false,
    )
    expect(isAppUrl('data:text/html,<script>x</script>', packaged)).toBe(false)
    expect(isAppUrl('not a url', packaged)).toBe(false)
  })
})

describe('isSafeExternalUrl', () => {
  test('web urls can go to the browser', () => {
    expect(isSafeExternalUrl('https://jbrowse.org')).toBe(true)
    expect(isSafeExternalUrl('http://jbrowse.org')).toBe(true)
  })

  // openExternal would hand these to the OS to launch
  test('anything the OS would launch locally is refused', () => {
    expect(isSafeExternalUrl('file:///home/u/evil.desktop')).toBe(false)
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeExternalUrl('smb://share/evil.exe')).toBe(false)
    expect(isSafeExternalUrl('garbage')).toBe(false)
  })
})

describe('isOAuthRedirect', () => {
  // what the desktop OAuth flow registers, and what it therefore waits for
  const redirectUri = 'http://localhost/auth'

  test('the redirect carrying the code is recognized', () => {
    expect(isOAuthRedirect('http://localhost/auth?code=abc', redirectUri)).toBe(
      true,
    )
    expect(
      isOAuthRedirect('http://localhost/auth#token=abc', redirectUri),
    ).toBe(true)
    expect(isOAuthRedirect(redirectUri, redirectUri)).toBe(true)
  })

  // the reason this is not `startsWith`: every one of these shares the
  // redirect_uri as a prefix while naming somewhere else, and the provider
  // controls the redirect chain
  test('a url that merely starts with the redirect uri is refused', () => {
    expect(
      isOAuthRedirect('http://localhost/authz?code=abc', redirectUri),
    ).toBe(false)
    expect(
      isOAuthRedirect('http://localhost/auth.evil.com/x', redirectUri),
    ).toBe(false)
  })

  test('a different origin is refused, scheme included', () => {
    expect(isOAuthRedirect('http://localhost:8080/auth', redirectUri)).toBe(
      false,
    )
    expect(isOAuthRedirect('https://localhost/auth', redirectUri)).toBe(false)
    expect(isOAuthRedirect('http://evil.example/auth', redirectUri)).toBe(false)
  })

  test('unparseable input is refused rather than throwing', () => {
    expect(isOAuthRedirect('not a url', redirectUri)).toBe(false)
    expect(isOAuthRedirect('http://localhost/auth', 'not a url')).toBe(false)
  })
})
