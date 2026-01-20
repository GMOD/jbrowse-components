import fetch from '../fetchWithProxy.ts'

export async function createRemoteStream(urlIn: string) {
  const res = await fetch(urlIn)
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${res.status} ${await res.text()}`,
    )
  }
  return res
}

export function isURL(FileName: string) {
  let url: URL | undefined

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

const SUPPORTED_ADAPTERS = new Set([
  'Gff3TabixAdapter',
  'VcfTabixAdapter',
  'Gff3Adapter',
  'VcfAdapter',
])

export function supported(type = '') {
  return SUPPORTED_ADAPTERS.has(type)
}
