import { getResponseError } from '../util.ts'

interface GoogleDriveError {
  error: {
    errors: {
      domain: string
      reason: string
      message: string
      locationType?: string
      location?: string
    }[]
    code: number
    message: string
  }
}

export async function getDescriptiveErrorMessage(
  response: Response,
  reason?: string,
) {
  const text = await response.text()
  let statusText = text
  try {
    const err = JSON.parse(text) as GoogleDriveError
    statusText = err.error.message
  } catch {
    // statusText stays as raw response text
  }
  return getResponseError({ response, reason, statusText })
}
