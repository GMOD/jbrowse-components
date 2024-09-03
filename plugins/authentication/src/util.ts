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
    .filter(f => !!f)
    .join(' - ')
}

export async function getError(response: Response) {
  try {
    return await response.text()
  } catch (e) {
    return response.statusText
  }
}
