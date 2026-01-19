export function fixup(buf: string) {
  return buf.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

export async function generateChallenge(val: string) {
  const CryptoJS = await import('crypto-js')
  return fixup(CryptoJS.enc.Base64.stringify(CryptoJS.SHA256(val)))
}

// if response is JSON, checks if it needs to remove tokens in error, or just plain throw
export function processError(text: string, invalidErrorCb: () => void) {
  try {
    const obj = JSON.parse(text)
    if (obj.error === 'invalid_grant') {
      invalidErrorCb()
    }
    return obj?.error_description ?? text
  } catch (e) {
    /* response text is not json, just use original text as error */
  }
  return text
}

export function processTokenResponse(
  data: { refresh_token?: string; access_token: string },
  storeRefreshTokenCb: (str: string) => void,
) {
  if (data.refresh_token) {
    storeRefreshTokenCb(data.refresh_token)
  }
  return data.access_token
}
