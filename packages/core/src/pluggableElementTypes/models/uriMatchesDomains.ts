/**
 * Whether a URL falls under one of an internet account's `domains` entries —
 * i.e. whether that account's credentials should be attached to it.
 *
 * This was a plain `uri.includes(domain)` over the whole URI, which is not a
 * containment test at all: `https://evil.example.com/?x=drive.google.com`
 * matched a Google Drive account, and jbrowse-web reads session specs (tracks
 * and all) out of the URL, so a link could aim someone's Drive token at a
 * server of the link author's choosing. `evil-dropbox.com` matched too.
 *
 * An entry is one of two shapes, told apart by whether it contains a `/`:
 *
 * - **a host** (`dropbox.com`, `localhost:8080`) — matches that host and its
 *   subdomains, on a dot boundary. Both defaulted account types spell their
 *   domains this way.
 * - **a URL prefix** (`https://data.mylab.org/reads/`, `mylab.org/reads`) — the
 *   scheme is optional, and the match runs to a path-segment boundary, so
 *   `/reads` does not match `/readsets`. This is the shape RpcManager's
 *   ephemeral HTTP Basic accounts store (origin + the file's directory), and
 *   the shape a config uses to scope an account to part of a server.
 *
 * The query string and fragment are never consulted under either shape: they
 * are the caller's data, not the server's identity.
 *
 * A URI that is not absolute matches nothing. Callers hold a `baseUri` for
 * those and are expected to resolve first (`resolveUriLocation`) — matching a
 * relative path against a host could only ever succeed by accident.
 */
export function uriMatchesDomains(uri: string, domains: string[]) {
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  // `host` carries the port and `hostname` does not, so an entry can name
  // either `localhost:8080` or `localhost` and mean it
  const hosts = [url.hostname.toLowerCase(), url.host.toLowerCase()]
  // paths, unlike hosts, are case-sensitive, so these are compared as written
  const prefixable = [
    `${url.origin}${url.pathname}`,
    `${url.host}${url.pathname}`,
  ]

  return domains.some(domain => {
    if (!domain) {
      return false
    }
    if (domain.includes('/')) {
      return prefixable.some(
        candidate =>
          candidate.startsWith(domain) &&
          (domain.endsWith('/') ||
            candidate.length === domain.length ||
            candidate[domain.length] === '/'),
      )
    }
    // A leading dot is the cookie-domain spelling of "and its subdomains",
    // which is what this branch does anyway. It read as a substring under the
    // old `includes` test and so worked; taken literally here it is a hostname
    // no URL can have, and the account would have gone quietly unused.
    const lower = domain.toLowerCase().replace(/^\./, '')
    return hosts.some(host => host === lower || host.endsWith(`.${lower}`))
  })
}
