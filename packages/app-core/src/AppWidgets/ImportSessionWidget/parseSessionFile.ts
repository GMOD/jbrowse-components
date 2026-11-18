import { isObject } from '@jbrowse/core/util'
import { isSessionSnapshot } from '@jbrowse/product-core'

// The file's id is dropped so the import opens as a new session: keeping it
// would autosave over the saved session the file was exported from.
export function parseSessionFile(text: string) {
  const parsed: unknown = JSON.parse(text)
  if (!isObject(parsed)) {
    throw new Error('File does not contain a JSON object')
  }
  const session = 'session' in parsed ? parsed.session : parsed
  if (!isSessionSnapshot(session)) {
    throw new Error(
      isObject(session) && !Array.isArray(session)
        ? 'The session in this file has no "name", so it is not a JBrowse session export.'
        : 'No session found in file. Expected a JBrowse session export (a JSON file with a top-level "session" key).',
    )
  }
  const { id: _id, ...rest } = session
  return rest
}
