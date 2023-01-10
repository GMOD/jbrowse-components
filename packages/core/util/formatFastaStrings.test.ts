import { formatSeqFasta, formatFastaLines } from './formatFastaStrings'

const small = 'cattgttgcg'
const medium =
  'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct'
const large =
  'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcctt'
test('sequence length is less than 80 characters', () => {
  const formattedSmallFasta = formatFastaLines(small)
  expect(formattedSmallFasta).toMatchSnapshot()
})

test('sequence length is 80 characters', () => {
  const formattedMediumFasta = formatFastaLines(medium)
  expect(formattedMediumFasta).toMatchSnapshot()
})

test('sequence length is more than 80 characters', () => {
  const formattedLargeFasta = formatFastaLines(large)
  expect(formattedLargeFasta).toMatchSnapshot()
})

test('formats headers and sequence', () => {
  const chunks = [
    { header: 'ctgA:1-10', seq: small },
    { header: 'ctgB:1-81', seq: large },
  ]
  const formattedFastaFile = formatSeqFasta(chunks)
  expect(formattedFastaFile).toMatchSnapshot()
})
