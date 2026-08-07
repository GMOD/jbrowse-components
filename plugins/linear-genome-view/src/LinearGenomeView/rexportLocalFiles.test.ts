import { readsBrowserLocalFile } from './rexportLocalFiles.ts'

// The two shapes jbrowse-web's "Choose File" produces: a File System Access
// handle where the browser supports it, a Blob otherwise. Neither carries a
// path, so the R script has nothing to read and the track is declined.
test('a blob or file-handle location is browser-local', () => {
  expect(
    readsBrowserLocalFile({
      type: 'BamAdapter',
      bamLocation: {
        locationType: 'BlobLocation',
        name: 'reads.bam',
        blobId: 'b1',
      },
    }),
  ).toBe(true)
  expect(
    readsBrowserLocalFile({
      type: 'BamAdapter',
      bamLocation: {
        locationType: 'FileHandleLocation',
        name: 'reads.bam',
        handleId: 'h1',
      },
    }),
  ).toBe(true)
})

// jbrowse-desktop's normal case, and the whole point of the advice attached to
// the declined ones: a localPath is a path R opens like any other.
test('a uri or localPath adapter is exportable', () => {
  expect(
    readsBrowserLocalFile({
      type: 'BamAdapter',
      bamLocation: {
        locationType: 'UriLocation',
        uri: 'https://example.com/reads.bam',
      },
    }),
  ).toBe(false)
  expect(
    readsBrowserLocalFile({
      type: 'BamAdapter',
      bamLocation: {
        locationType: 'LocalPathLocation',
        localPath: '/data/reads.bam',
      },
    }),
  ).toBe(false)
  expect(readsBrowserLocalFile(undefined)).toBe(false)
  expect(readsBrowserLocalFile({})).toBe(false)
})

// The location that matters need not be the adapter's own: a multi-wiggle
// reads through subadapters, and a track whose data is a url but whose INDEX
// was picked off the desktop is just as unreadable — R would find the data and
// not the index.
test('a nested location counts, wherever it sits in the config', () => {
  expect(
    readsBrowserLocalFile({
      type: 'MultiWiggleAdapter',
      subadapters: [
        {
          type: 'BigWigAdapter',
          bigWigLocation: { locationType: 'UriLocation', uri: 'a.bw' },
        },
        {
          type: 'BigWigAdapter',
          bigWigLocation: { locationType: 'BlobLocation', blobId: 'b2' },
        },
      ],
    }),
  ).toBe(true)
  expect(
    readsBrowserLocalFile({
      type: 'VcfTabixAdapter',
      vcfGzLocation: { locationType: 'UriLocation', uri: 'v.vcf.gz' },
      index: {
        location: { locationType: 'FileHandleLocation', handleId: 'h2' },
      },
    }),
  ).toBe(true)
})

// A legacy (pre-locationType) snapshot stores only the discriminating field.
test('an untagged legacy location is recognized by its id field', () => {
  expect(readsBrowserLocalFile({ bamLocation: { blobId: 'b3' } })).toBe(true)
  expect(readsBrowserLocalFile({ bamLocation: { uri: 'x.bam' } })).toBe(false)
})
