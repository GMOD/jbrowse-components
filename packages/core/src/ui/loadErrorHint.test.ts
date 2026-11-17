import { loadErrorHint } from './loadErrorHint.ts'

const BAM = 'https://example.org/data/volvox.bam'

test.each([
  {
    text: `Error: HTTP 404 fetching ${BAM}`,
    hint: `${BAM} was not found (HTTP 404): check the track's file location for a typo or a file that moved.`,
  },
  {
    text: `HTTP 404 fetching ${BAM}.bai`,
    hint: `The index ${BAM}.bai was not found (HTTP 404): set the track's index location, or put the index beside the data file.`,
  },
  {
    text: 'HTTP 404 fetching https://example.org/v.vcf.gz.tbi?token=abc',
    hint: "The index https://example.org/v.vcf.gz.tbi?token=abc was not found (HTTP 404): set the track's index location, or put the index beside the data file.",
  },
  {
    text: `TypeError: Failed to fetch fetching ${BAM}`,
    hint: `${BAM} could not be reached: the server is down, or it does not send the CORS headers that let this site read it.`,
  },
  {
    text: `NetworkError when attempting to fetch resource fetching ${BAM}`,
    hint: `${BAM} could not be reached: the server is down, or it does not send the CORS headers that let this site read it.`,
  },
  {
    text: `Load failed fetching ${BAM}`,
    hint: `${BAM} could not be reached: the server is down, or it does not send the CORS headers that let this site read it.`,
  },
  {
    text: `${BAM} fetch returned status 200, expected 206`,
    hint: `${BAM} sent the whole file instead of the requested bytes: the server must support HTTP Range requests.`,
  },
  {
    text: 'Error: Not a BAI file',
    hint: "The index is not a BAI file: point the track's index location at the .bai made for this data file.",
  },
  {
    text: 'Not a TBI file',
    hint: "The index is not a TBI file: point the track's index location at the .tbi made for this data file.",
  },
  {
    text: 'invalid .crai index file, expected 6 fields per record but got 1',
    hint: "The index is not a CRAI file: point the track's index location at the .crai made for this data file.",
  },
  { text: 'HTTP 500 fetching https://example.org/a.bam', hint: undefined },
  { text: 'HTTP 404 - missing', hint: undefined },
  { text: 'Failed to fetch', hint: undefined },
  {
    text: 'file ("x.bam") was opened locally from a previous session. To restore it, go to track settings and reopen the file',
    hint: undefined,
  },
  { text: 'something else went wrong', hint: undefined },
])('$text', ({ text, hint }) => {
  expect(loadErrorHint(text)).toBe(hint)
})
