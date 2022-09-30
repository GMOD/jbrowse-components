export async function mfetch(url: string, request?: RequestInit) {
  const response = await fetch(url, request)
  if (!response.ok) {
    throw new Error(
      `HTTP 
          ${response.status}: ${await response.text()} from
          ${url}`,
    )
  }
  return response.json()
}

export async function post_with_params(
  url: string,
  params = {} as Record<string, unknown>,
  options = {} as RequestInit,
) {
  const urlParams = Object.keys(params)
    .map(param => `${param}=${params[param]}`)
    .join(';')
  return mfetch(`${url}${urlParams ? `?${urlParams}` : ''}`, {
    ...options,
    method: 'POST',
  })
}
