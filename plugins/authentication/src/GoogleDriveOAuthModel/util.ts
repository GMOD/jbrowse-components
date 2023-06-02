import { getResponseError } from '../util'

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
  let errorMessage = ''
  try {
    const err = JSON.parse(await response.text()) as GoogleDriveError
    errorMessage = err.error.message
  } catch (error) {
    /* do nothing */
  }
  return getResponseError({ response, reason, statusText: errorMessage })
}
