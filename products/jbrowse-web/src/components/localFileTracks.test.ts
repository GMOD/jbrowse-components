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
