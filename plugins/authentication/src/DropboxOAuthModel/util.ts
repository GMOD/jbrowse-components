import { descriptiveErrorMessage } from '../util.ts'

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

export const getDescriptiveErrorMessage = descriptiveErrorMessage<DropboxError>(
  err => {
    const tag = err.error['.tag']
    return dropboxErrorMessages[tag] ?? tag
  },
)
