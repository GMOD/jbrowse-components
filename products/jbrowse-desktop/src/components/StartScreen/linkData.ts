import { isObject } from '@jbrowse/core/util'
import { addRelativeUris } from '@jbrowse/core/util/addRelativeUris'
import { locationLocalPath } from '@jbrowse/core/util/io'

// A link reaches Desktop from whatever page wanted it opened, and Desktop reads
// a local path with Node. So a link's config or session naming one turns a click
// into a read of this machine, and on Windows a `file://host/share/…` one into
// an SMB connection that offers the user's credentials to that host. JBrowse Web
// cannot read a local file at all, so no link made for it needs one.

// A location that throws here throws in openLocation too, and reads nothing
function readsLocally(value: unknown) {
  try {
    return typeof value === 'string' && /^file:/i.test(value)
      ? value
      : locationLocalPath(value)
  } catch {
    return undefined
  }
}

function localPathIn(value: unknown): string | undefined {
  return (
    readsLocally(value) ??
    (isObject(value) ? Object.values(value) : [])
      .map(localPathIn)
      .find(path => path !== undefined)
  )
}

/**
 * Refuse a config or session that arrived by link and names a file on this
 * machine.
 */
export function assertReadsNoLocalFiles(value: unknown) {
  const path = localPathIn(value)
  if (path !== undefined) {
    throw new Error(
      `This link names a file on this computer (${path}), and a link opens only data from the web. To use local files, open a session or config.json saved on this computer.`,
    )
  }
}

/**
 * A link's own session data, its relative files resolved against the JBrowse
 * Web page the link points at, as that page resolves them.
 */
export function linkData<T extends object>(data: T, pageUrl: string) {
  addRelativeUris({ data }, new URL(pageUrl))
  assertReadsNoLocalFiles(data)
  return data
}
