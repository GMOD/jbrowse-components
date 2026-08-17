import '@testing-library/jest-dom'

import { fireEvent, screen } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

setup()

// The whole path from column 9 to the chip, over a GFF3 written the way real
// annotations write it (test_data/volvox/volvox.canonical_tags.gff3): NCBI's
// `tag=MANE Select` is one value with a space in it, GENCODE's is a comma list
// with `MANE_Select` buried in it, and every tagged transcript in the file is
// the SHORTER protein, so a collapse that kept it can only have read the tag.
//
// Unit tests reach `layoutSubfeatures` with a hand-built feature whose
// `get('tag')` answers whatever the test decided it answers. That is the one
// question they cannot ask: whether a GFF3 attribute reaches the ranking under
// the name it looks for and in the shape it expects. It does — gff-nostream
// splits a comma list into an array and leaves a spaced single value a string,
// both of which `canonicalRank` matches member-wise — and this is where that
// stays true.
const config = volvoxConfigWithTracks(['gff3tabix_canonical_tags'])

beforeEach(() => {
  doBeforeEach()
})

const delay = { timeout: 30000 }

test('the chip names the tag that picked the transcripts on screen', async () => {
  const { view, session } = await createView(config)
  await view.navToLocString('ctgA:1..40,000')
  fireEvent.click(
    await screen.findByTestId(hts('gff3tabix_canonical_tags'), {}, delay),
  )
  await findAnyDisplayPainted(delay)

  // MANEG's `tag=MANE Select` and GENCG's `tag=…,MANE_Select,…` are one curated
  // decision spelled two ways, so they count as one rule and it is the majority;
  // ENSG carries only `Ensembl_canonical`, and PLAING carries nothing at all.
  const display = session.views[0].tracks[0].displays[0]
  expect(display.geneGlyphNotice.picks).toEqual({
    byTag: { 'MANE Select': 2, 'Ensembl canonical': 1 },
    byLength: 1,
  })
  expect(await screen.findByText('MANE Select', {}, delay)).toBeInTheDocument()

  // and the tag is what actually chose them: every tagged transcript here is
  // the shorter protein, so length would have kept the other one. The gene is
  // the top-level feature, so its surviving isoform is a subfeature entry.
  const drawn = new Set(
    [...display.rpcDataMap.values()].flatMap(data =>
      data.subfeatureInfos.map(
        (item: { displayLabel?: string }) => item.displayLabel,
      ),
    ),
  )
  expect(drawn.has('NM_000001.1')).toBe(true)
  expect(drawn.has('NM_000002.1')).toBe(false)
})
