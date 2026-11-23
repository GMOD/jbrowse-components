/**
 * @jest-environment node
 */

import http from 'node:http'

import { adminUrl, parsePort, startServer } from './utils.ts'

test('defaults when no port string is given', () => {
  expect(parsePort({ portStr: undefined })).toBe(9090)
  expect(parsePort({ portStr: undefined, defaultPort: 8080 })).toBe(8080)
})

test('parses a valid port', () => {
  expect(parsePort({ portStr: '3000' })).toBe(3000)
})

test('accepts the boundary ports 1 and 65535', () => {
  expect(parsePort({ portStr: '1' })).toBe(1)
  expect(parsePort({ portStr: '65535' })).toBe(65535)
})

test('rejects out-of-range ports', () => {
  expect(() => parsePort({ portStr: '0' })).toThrow(/not a valid port/)
  expect(() => parsePort({ portStr: '65536' })).toThrow(/not a valid port/)
  expect(() => parsePort({ portStr: '-10' })).toThrow(/not a valid port/)
})

test.each(['80abc', '1.5', 'abc'])('rejects the malformed port %s', portStr => {
  expect(() => parsePort({ portStr })).toThrow(/not a valid port/)
})

function bind(host?: string) {
  return new Promise<string | undefined>(resolve => {
    const server = http.createServer(() => {})
    server.on('listening', () => {
      const address = server.address()
      server.close(() => {
        resolve(typeof address === 'object' ? address?.address : address)
      })
    })
    startServer({
      server,
      port: 0,
      host,
      key: 'key',
      outFile: 'config.json',
      serverRef: { current: null },
    })
  })
}

test('binds loopback unless --host widens it', async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  expect(await bind()).toBe('127.0.0.1')
  expect(await bind('0.0.0.0')).toBe('0.0.0.0')
})

test.each([
  ['127.0.0.1', 'localhost'],
  ['127.0.0.2', 'localhost'],
  ['0.0.0.0', 'localhost'],
  ['::', 'localhost'],
  ['::1', 'localhost'],
  ['localhost', 'localhost'],
  ['192.168.4.40', '192.168.4.40'],
  ['myhost.example.org', 'myhost.example.org'],
  ['fe80::1', '[fe80::1]'],
])('the startup URL for --host %s names %s', (host, reachable) => {
  expect(adminUrl({ host, port: 9090, key: 'k' })).toBe(
    `http://${reachable}:9090?adminKey=k`,
  )
})
