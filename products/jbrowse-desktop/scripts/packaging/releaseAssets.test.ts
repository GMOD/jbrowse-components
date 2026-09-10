import { auditRelease, parseUpdateFeed } from './releaseAssets.ts'

// Byte-for-byte what a v4.3.0 client reads off the release today, so the parser
// is answering the real thing and not the generator's current spelling.
const SHIPPED = `version: 4.3.0
files:
  - url: jbrowse-desktop-v4.3.0-linux.AppImage
    sha512: kzy8CjTcyFpPbrWHn4AAe05EGEgj6FZQGSz7L0RsPW82gigcBsoejtzspP2mRpzgvF0+d3jOBcHW7mhGrizdxA==
    size: 119568888
path: jbrowse-desktop-v4.3.0-linux.AppImage
sha512: kzy8CjTcyFpPbrWHn4AAe05EGEgj6FZQGSz7L0RsPW82gigcBsoejtzspP2mRpzgvF0+d3jOBcHW7mhGrizdxA==
releaseDate: '2026-05-21T17:12:41.606Z'`

test('the shipped manifest parses to the file it names', () => {
  expect(parseUpdateFeed(SHIPPED)).toEqual([
    {
      name: 'jbrowse-desktop-v4.3.0-linux.AppImage',
      sha512:
        'kzy8CjTcyFpPbrWHn4AAe05EGEgj6FZQGSz7L0RsPW82gigcBsoejtzspP2mRpzgvF0+d3jOBcHW7mhGrizdxA==',
      size: 119568888,
    },
  ])
})

// The trailing `path:`/`sha512:` pair sits at column zero and repeats the first
// file. Reading it as a second entry would invent an asset that is not there.
test('the legacy trailer is not a second file', () => {
  expect(parseUpdateFeed(SHIPPED).length).toBe(1)
})

test('quoted values parse the same as bare ones', () => {
  expect(
    parseUpdateFeed(
      "files:\n  - url: 'a.zip'\n    sha512: 'h=='\n    size: 7\n",
    ),
  ).toEqual([{ name: 'a.zip', sha512: 'h==', size: 7 }])
})

const manifest = {
  name: 'latest-mac.yml',
  files: [{ name: 'app.zip', sha512: 'h==', size: 10 }],
}

test('a complete release has nothing to say about it', () => {
  expect(
    auditRelease({
      expected: ['app.zip', 'latest-mac.yml'],
      assets: [
        { name: 'app.zip', size: 10 },
        { name: 'latest-mac.yml', size: 200 },
      ],
      manifests: [manifest],
    }),
  ).toEqual([])
})

// The one this exists for: a platform's job did not upload, and the release
// looks fine because the other two did.
test('a missing artifact is named', () => {
  expect(
    auditRelease({
      expected: ['app.zip', 'latest-mac.yml'],
      assets: [{ name: 'app.zip', size: 10 }],
      manifests: [],
    }),
  ).toEqual(['latest-mac.yml is not on the release'])
})

// Names all match and the bytes do not — a manifest uploaded beside a different
// build of the artifact it names. A client sees this as a failed hash after a
// full download; the size says it for free.
test('a manifest describing different bytes is caught', () => {
  expect(
    auditRelease({
      expected: [],
      assets: [{ name: 'app.zip', size: 11 }],
      manifests: [manifest],
    }),
  ).toEqual(['latest-mac.yml says app.zip is 10 bytes; the release has 11'])
})

test('a manifest naming an absent artifact is caught', () => {
  expect(
    auditRelease({ expected: [], assets: [], manifests: [manifest] }),
  ).toEqual(['latest-mac.yml names app.zip, which is not there'])
})

// Well-formed, uploads cleanly, and answers every client with "no files".
test('an empty manifest is caught', () => {
  expect(
    auditRelease({
      expected: [],
      assets: [],
      manifests: [{ name: 'latest.yml', files: [] }],
    }),
  ).toEqual(['latest.yml lists no files, so it updates nobody'])
})
