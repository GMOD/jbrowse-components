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
  } catch {
    return response.statusText
  }
}

/**
 * Builds the `describeError` a provider hands `validateTokenWithProbe` and
 * throws from its fetcher: read the body, pull the human-readable part out of
 * the provider's own error JSON, and fall back to the raw text when it is not
 * that shape at all — an HTML error page from a proxy in front of the API, say.
 *
 * `extract` runs inside the same guard as the parse, so it may reach into the
 * payload without checking each hop.
 */
export function descriptiveErrorMessage<T>(
  extract: (parsed: T) => string | undefined,
) {
  return async (response: Response, reason?: string) => {
    const text = await response.text()
    let statusText = text
    try {
      statusText = extract(JSON.parse(text) as T) ?? text
    } catch {
      // statusText stays as raw response text
    }
    return getResponseError({ response, reason, statusText })
  }
}
