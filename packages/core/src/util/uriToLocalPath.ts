/**
 * The local path a `file:` URI or a bare absolute path names, or undefined for
 * anything else. A Windows URL parses as `/C:/data/x.bam`, whose leading slash
 * is part of the URL grammar rather than the path, and a host is a network
 * share: `\\server\share\x.bam` is `file://server/share/x.bam`.
 */
export function uriToLocalPath(uri: string) {
  if (uri.startsWith('/') || /^[a-z]:[\\/]/i.test(uri)) {
    return uri
  }
  if (!uri.startsWith('file:')) {
    return undefined
  }
  try {
    const { host, pathname } = new URL(uri)
    const decoded = decodeURIComponent(pathname)
    return host && host !== 'localhost'
      ? `//${host}${decoded}`
      : /^\/[a-z]:/i.test(decoded)
        ? decoded.slice(1)
        : decoded
  } catch {
    return undefined
  }
}
