import fetch, { RequestInfo, RequestInit } from 'node-fetch'
import ProxyAgent from 'proxy-agent'

export default function fetchWithProxy(
  url: RequestInfo,
  options: RequestInit = {},
) {
  const agent = new ProxyAgent()
  return fetch(url, { agent, ...options })
}
