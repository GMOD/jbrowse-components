import '@testing-library/jest-dom'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen } from '@testing-library/react'

import LaunchSyntenyViewDialog from './LaunchSyntenyViewDialog.tsx'

import type { AbstractSessionModel } from '@jbrowse/core/util'

// A chain-scale block: 2 Mb on each side, a CIGAR that walks straight through,
// so the visible window maps to the same offsets on the mate.
function chainBlock(strand = 1) {
  return new SimpleFeature({
    uniqueId: 'chain1',
    refName: 'chr11',
    start: 1_000_000,
    end: 3_000_000,
    strand,
    CIGAR: '2000000M',
    mate: {
      refName: 'chr11_hs1',
      start: 5_000_000,
      end: 7_000_000,
      assemblyName: 'hs1',
    },
  })
}

function renderDialog(feature: SimpleFeature) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LaunchSyntenyViewDialog
        session={{} as AbstractSessionModel}
        feature={feature}
        region={{ start: 1_900_000, end: 1_950_000 }}
        anchorAssembly="hg38"
        trackId="t1"
        handleClose={() => {}}
      />
    </ThemeProvider>,
  )
}

// The preview is the dialog's answer to "what will this open on": the region
// dialog prints one line per panel, and this one used to print nothing, so the
// clip checkbox's effect was invisible until launch.
test('previews both panels clipped to the window, unpadded', () => {
  renderDialog(chainBlock())
  expect(screen.getByText('hg38')).toBeInTheDocument()
  expect(screen.getByText('hs1')).toBeInTheDocument()
  expect(
    screen.getByText('chr11:1,900,001..1,950,000 (50Kbp)'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('chr11_hs1:5,900,001..5,950,000 (50Kbp)'),
  ).toBeInTheDocument()
})

test('unticking the clip previews the whole block', () => {
  renderDialog(chainBlock())
  fireEvent.click(
    screen.getByLabelText(
      'Use CIGAR to map the current visible region to the target',
    ),
  )
  expect(
    screen.getByText('chr11:1,000,001..3,000,000 (2Mbp)'),
  ).toBeInTheDocument()
  expect(
    screen.getByText('chr11_hs1:5,000,001..7,000,000 (2Mbp)'),
  ).toBeInTheDocument()
})

// The strand is spelled on the mate row rather than folded into the locstring:
// the flip checkbox decides which way the panel opens, not where.
test('an inverted block marks the mate row and offers the flip', () => {
  renderDialog(chainBlock(-1))
  expect(
    screen.getByText('chr11_hs1:6,050,001..6,100,000 (-) (50Kbp)'),
  ).toBeInTheDocument()
  expect(
    screen.getByLabelText('Horizontally flip inverted targets'),
  ).toBeChecked()
})
