import { findLocalFileNames } from './localFileTracks.ts'

const localBam = {
  locationType: 'LocalPathLocation',
  localPath: '/home/me/reads.bam',
}

test('a session track is read with its delta merged over it', () => {
  expect(
    findLocalFileNames({
      sessionTracks: [
        {
          trackId: 'reads',
          name: 'Reads',
          adapter: { type: 'BamAdapter', bamLocation: { uri: 'reads.bam' } },
        },
      ],
      trackConfigDeltas: {
        reads: {
          trackId: 'reads',
          name: 'My reads',
          adapter: { bamLocation: localBam },
        },
      },
    }),
  ).toEqual(['My reads'])
})

test('a connection reading a local file is named', () => {
  expect(
    findLocalFileNames({
      sessionConnections: [
        { connectionId: 'hub', name: 'My hub', hubTxtLocation: localBam },
        {
          connectionId: 'remote',
          name: 'Remote hub',
          hubTxtLocation: { uri: 'https://x/hub.txt' },
        },
      ],
    }),
  ).toEqual(['My hub'])
})
