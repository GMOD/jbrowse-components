import { matchTrackId } from './matchTrackId.ts'

test('exact string match', () => {
  expect(matchTrackId('volvox.inv.vcf', ['volvox.inv.vcf'])).toBe(true)
  expect(matchTrackId('volvox.inv.vcf', ['other'])).toBe(false)
})

test('regex matches session copies with -sessionTrack suffix', () => {
  expect(
    matchTrackId('volvox.inv.vcf-1700000000000-sessionTrack', [
      /^volvox\.inv\.vcf/,
    ]),
  ).toBe(true)
})

test('undefined trackId never matches', () => {
  expect(matchTrackId(undefined, ['volvox.inv.vcf', /x/])).toBe(false)
})

test('any pattern in the list can match', () => {
  expect(matchTrackId('genes', ['variants', /gene/])).toBe(true)
})
