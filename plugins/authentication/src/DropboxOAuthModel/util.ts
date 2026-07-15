import { getResponseError } from '../util.ts'

interface DropboxError {
  error_summary: string
  error: {
    '.tag': string
  }
}

/**
 * Error messages from
 * https://www.dropbox.com/developers/documentation/http/documentation#sharing-get_shared_link_file
 * */
const dropboxErrorMessages: Record<string, string> = {
  shared_link_not_found: "The shared link wasn't found.",
  shared_link_access_denied:
    'The caller is not allowed to access this shared link.',
  unsupported_link_type:
    'This type of link is not supported; use files/export instead.',
  shared_link_is_directory: 'Directories cannot be retrieved by this endpoint.',
}

export async function getDescriptiveErrorMessage(
  response: Response,
  reason?: string,
) {
  const text = await response.text()
  let statusText = text
  try {
    const err = JSON.parse(text) as DropboxError
    const tag = err.error['.tag']
    statusText = dropboxErrorMessages[tag] ?? tag
  } catch {
    // statusText stays as raw response text
  }
  return getResponseError({ response, reason, statusText })
}
