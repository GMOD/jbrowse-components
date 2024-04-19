import { fetch } from 'node-fetch-native/node'
import { createProxy } from 'node-fetch-native/proxy'

const proxy = createProxy()

// The correct proxy `Agent` implementation to use will be determined
// via the `http_proxy` / `https_proxy` / `no_proxy` / etc. env vars
// https://github.com/unjs/node-fetch-native?tab=readme-ov-file#proxy-support
export default function fetchWithProxy(
  url: RequestInfo,
  options: RequestInit = {},
) {
  return fetch(url, { ...options, ...proxy })
}
