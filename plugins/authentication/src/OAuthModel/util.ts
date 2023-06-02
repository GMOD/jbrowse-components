export function fixup(buf: string) {
  return buf.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function generateChallenge(val: string) {
  const sha256 = await import('crypto-js/sha256').then(f => f.default)
  const Base64 = await import('crypto-js/enc-base64')
  return fixup(Base64.stringify(sha256(val)))
}

export async function getError(response: Response) {
  try {
    return response.text()
  } catch (e) {
    return response.statusText
  }
}
