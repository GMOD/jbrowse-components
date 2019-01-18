import tenaciousFetch from 'tenacious-fetch'
import { openUrl } from './rangeFetcher'

jest.mock('tenacious-fetch')

test('can fetch a whole file from someplace with no headers at all', async () => {
  tenaciousFetch.mockResolvedValue(
    new Response(
      `aiieeee
`,
      { headers: {} },
    ),
  )

  const filehandle = openUrl('http://example.com/something')
  const buffer = await filehandle.readFile()
  expect(buffer.length).toBeGreaterThan(1)
})
