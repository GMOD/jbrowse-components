import { uriMatchesDomains } from './uriMatchesDomains.ts'

const dropbox = ['dropbox.com', 'db.tt', 'dropboxapi.com']

describe('host entries', () => {
  it('matches the host itself and its subdomains', () => {
    expect(uriMatchesDomains('https://dropbox.com/s/x.bam', dropbox)).toBe(true)
    expect(uriMatchesDomains('https://www.dropbox.com/s/x.bam', dropbox)).toBe(
      true,
    )
    expect(
      uriMatchesDomains('https://content.dropboxapi.com/2/files', dropbox),
    ).toBe(true)
  })

  it('does not match a host that merely ends with the same letters', () => {
    expect(uriMatchesDomains('https://evil-dropbox.com/x.bam', dropbox)).toBe(
      false,
    )
    expect(uriMatchesDomains('https://notdb.tt/x.bam', dropbox)).toBe(false)
  })

  it('does not match a host that only contains the entry deeper in its name', () => {
    expect(
      uriMatchesDomains('https://dropbox.com.evil.io/x.bam', dropbox),
    ).toBe(false)
  })

  // the reason this is a structured match rather than a substring one:
  // jbrowse-web builds tracks out of session specs read from its own URL, so a
  // link could otherwise name a server of its choosing and be handed the
  // reader's Drive or Dropbox token
  it('ignores the query string and the fragment', () => {
    expect(
      uriMatchesDomains('https://evil.example.com/?x=dropbox.com', dropbox),
    ).toBe(false)
    expect(
      uriMatchesDomains('https://evil.example.com/#dropbox.com', dropbox),
    ).toBe(false)
  })

  it('does not match the entry appearing in the path', () => {
    expect(
      uriMatchesDomains('https://evil.example.com/dropbox.com/x.bam', dropbox),
    ).toBe(false)
  })

  it('is case-insensitive about the host', () => {
    expect(uriMatchesDomains('https://WWW.Dropbox.COM/s/x.bam', dropbox)).toBe(
      true,
    )
  })

  it('matches an entry naming a port, and one omitting it', () => {
    expect(
      uriMatchesDomains('http://localhost:8080/x.bam', ['localhost']),
    ).toBe(true)
    expect(
      uriMatchesDomains('http://localhost:8080/x.bam', ['localhost:8080']),
    ).toBe(true)
    expect(
      uriMatchesDomains('http://localhost:9090/x.bam', ['localhost:8080']),
    ).toBe(false)
  })
})

describe('prefix entries', () => {
  // the shape RpcManager's ephemeral HTTP Basic accounts store: the origin
  // plus the directory the 401 came from
  const ephemeral = ['https://data.mylab.org/reads/']

  it('matches a file under the prefix', () => {
    expect(
      uriMatchesDomains('https://data.mylab.org/reads/x.bam', ephemeral),
    ).toBe(true)
  })

  it('does not match a sibling directory or another origin', () => {
    expect(
      uriMatchesDomains('https://data.mylab.org/other/x.bam', ephemeral),
    ).toBe(false)
    expect(
      uriMatchesDomains('https://elsewhere.org/reads/x.bam', ephemeral),
    ).toBe(false)
    expect(
      uriMatchesDomains('http://data.mylab.org/reads/x.bam', ephemeral),
    ).toBe(false)
  })

  it('accepts a schemeless prefix', () => {
    expect(
      uriMatchesDomains('https://mylab.org/data/x.bam', ['mylab.org/data']),
    ).toBe(true)
    expect(
      uriMatchesDomains('http://mylab.org/data/x.bam', ['mylab.org/data']),
    ).toBe(true)
  })

  it('stops at a path-segment boundary', () => {
    expect(
      uriMatchesDomains('https://mylab.org/database/x.bam', ['mylab.org/data']),
    ).toBe(false)
    expect(
      uriMatchesDomains('https://mylab.org/data', ['mylab.org/data']),
    ).toBe(true)
  })

  it('ignores the query string', () => {
    expect(
      uriMatchesDomains('https://evil.io/?u=https://data.mylab.org/reads/', [
        'https://data.mylab.org/reads/',
      ]),
    ).toBe(false)
  })
})

it('matches nothing for an empty domains list, an empty entry, or a relative uri', () => {
  expect(uriMatchesDomains('https://dropbox.com/x.bam', [])).toBe(false)
  expect(uriMatchesDomains('https://dropbox.com/x.bam', [''])).toBe(false)
  // callers resolve against baseUri before asking — see resolveUriLocation
  expect(uriMatchesDomains('reads/x.bam', ['mylab.org/reads'])).toBe(false)
})
