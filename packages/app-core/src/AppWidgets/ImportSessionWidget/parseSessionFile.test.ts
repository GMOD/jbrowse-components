import { parseSessionFile } from './parseSessionFile.ts'

test('reads an export wrapped under "session" and drops its id', () => {
  expect(
    parseSessionFile(
      JSON.stringify({ session: { id: 'abc', name: 'Mine', views: [] } }),
    ),
  ).toEqual({ name: 'Mine', views: [] })
})

test('reads a bare session snapshot', () => {
  expect(parseSessionFile(JSON.stringify({ id: 'abc', name: 'Bare' }))).toEqual(
    { name: 'Bare' },
  )
})

test('refuses a file with no session object', () => {
  expect(() => parseSessionFile('[]')).toThrow(/No session found/)
  expect(() => parseSessionFile('3')).toThrow(/JSON object/)
})

test('refuses a session with no name', () => {
  expect(() =>
    parseSessionFile(JSON.stringify({ session: { id: 'abc', views: [] } })),
  ).toThrow(/no "name"/)
  expect(() => parseSessionFile(JSON.stringify({ views: [] }))).toThrow(
    /no "name"/,
  )
})
