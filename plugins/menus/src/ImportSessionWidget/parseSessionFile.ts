// The file's id is dropped so the import opens as a new session: keeping it
// would autosave over the saved session the file was exported from.
export function parseSessionFile(text: string) {
  const parsed: unknown = JSON.parse(text)
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('File does not contain a JSON object')
  }
  const session = 'session' in parsed ? parsed.session : parsed
  if (!session || typeof session !== 'object' || Array.isArray(session)) {
    throw new Error(
      'No session found in file. Expected a JBrowse session export (a JSON file with a top-level "session" key).',
    )
  }
  const { id: _id, ...rest } = session as Record<string, unknown>
  return rest as { name: string; [key: string]: unknown }
}
