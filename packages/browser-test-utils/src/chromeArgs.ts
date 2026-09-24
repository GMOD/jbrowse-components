import { BASE_CHROME_ARGS as CAPTURE_CHROME_ARGS } from '@jbrowse/capture'

// The harness serves fixtures from several local origins; @jbrowse/capture
// keeps CORS on so a capture fails where a user's browser would.
export const BASE_CHROME_ARGS = [
  ...CAPTURE_CHROME_ARGS,
  '--disable-web-security',
]
