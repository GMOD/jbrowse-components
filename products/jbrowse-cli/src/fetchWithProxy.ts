import fetch, { RequestInfo, RequestInit } from 'node-fetch'
import { ProxyAgent } from 'proxy-agent'

// The correct proxy `Agent` implementation to use will be determined
// via the `http_proxy` / `https_proxy` / `no_proxy` / etc. env vars

export default function fetchWithProxy(
  url: RequestInfo,
  options: RequestInit = {},
) {
  const agent = new ProxyAgent()
  return fetch(url, { agent, ...options })
}
