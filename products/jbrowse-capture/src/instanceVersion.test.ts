/**
 * @jest-environment node
 */

import http from 'node:http'

import { assertSupportedInstance } from './instanceVersion.ts'

import type { AddressInfo } from 'node:net'

let server: http.Server
let body: string | undefined

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/jb2/version.txt' && body !== undefined) {
      res.end(body)
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, resolve))
})

afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
})

const instance = () =>
  `http://localhost:${(server.address() as AddressInfo).port}/jb2/`

test('a v4 instance is refused, naming its version', async () => {
  body = '4.3.0\n'
  await expect(assertSupportedInstance(instance())).rejects.toThrow(
    /serves JBrowse 4\.3\.0, and @jbrowse\/capture needs v5 or later/,
  )
})

test('an instance given without its trailing slash is still read', async () => {
  body = '4.3.0'
  await expect(
    assertSupportedInstance(instance().replace(/\/$/, '')),
  ).rejects.toThrow(/serves JBrowse 4\.3\.0/)
})

test.each(['5.0.0-beta.8', '5.0.0', '6.1.2'])('%s passes', async version => {
  body = version
  await expect(assertSupportedInstance(instance())).resolves.toBeUndefined()
})

test.each([
  ['no version.txt', undefined],
  ['an index page served in its place', '<!DOCTYPE html><html></html>'],
])('%s cannot be judged and passes', async (_name, served) => {
  body = served
  await expect(assertSupportedInstance(instance())).resolves.toBeUndefined()
})
