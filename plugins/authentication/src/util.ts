import type { UriLocation } from '@jbrowse/core/util/types'

export async function validateTokenWithHEAD(
  token: string,
  location: UriLocation,
  init: RequestInit,
) {
  const response = await fetch(location.uri, init)
  if (!response.ok) {
    throw new Error(
      await getResponseError({ response, reason: 'Error validating token' }),
    )
  }
  return token
}

export async function getResponseError({
  response,
  reason,
  statusText,
}: {
  response: Response
  reason?: string
  statusText?: string
}) {
  return [
    `HTTP ${response.status}`,
    reason,
    statusText ?? (await getError(response)),
  ]
    .filter(Boolean)
    .join(' - ')
}

export async function getError(response: Response) {
  try {
    return await response.text()
  } catch (e) {
    return response.statusText
  }
}
