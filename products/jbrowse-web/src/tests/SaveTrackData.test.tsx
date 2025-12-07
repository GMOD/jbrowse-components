import fs from 'fs'
import path from 'path'

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { saveAs } from 'file-saver-es'

import { createView, doBeforeEach, hts, setup } from './util'

jest.mock('file-saver-es', () => {
  return {
    ...jest.requireActual('file-saver-es'),
    saveAs: jest.fn(),
  }
})

setup()

beforeEach(() => {
  doBeforeEach()
  // this is a false positive
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  ;(saveAs as unknown as jest.Mock).mockClear()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

async function openSaveTrackDataDialog(
  user: ReturnType<typeof userEvent.setup>,
  trackId: string,
) {
  await user.click(await screen.findByTestId(hts(trackId), ...opts))
  await screen.findAllByTestId(/prerendered_canvas/, ...opts)
  await user.click(await screen.findByTestId('track_menu_icon', ...opts))
  await user.click(await screen.findByText('Save track data'))
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = reject
    // eslint-disable-next-line unicorn/prefer-blob-reading-methods
    reader.readAsText(blob)
  })
}

test.each([
  ['VCF', 'volvox_filtered_vcf', 'jbrowse_track_data.vcf', 'vcf'],
  ['BAM', 'volvox_bam', 'jbrowse_track_data.sam', 'sam'],
  ['CRAM', 'volvox_cram', 'jbrowse_track_data.sam', 'cram.sam'],
  ['GFF', 'gff3tabix_genes', 'jbrowse_track_data.gff3', 'gff3'],
  ['BED', 'bedtabix_genes', 'jbrowse_track_data.gff3', 'bed.gff3'],
  ['BigWig', 'volvox_microarray', 'jbrowse_track_data.bedgraph', 'bedgraph'],
])(
  'save track data for %s track',
  async (_, trackId, expectedFilename, ext) => {
    const user = userEvent.setup()
    const { view } = await createView()
    await view.navToLocString('ctgA:4,318..4,440')

    await openSaveTrackDataDialog(user, trackId)

    await screen.findByText('File type', ...opts)

    await user.click(await screen.findByText('Download'))

    await waitFor(() => {
      // this is a false positive
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // this is a false positive
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const call = (saveAs as unknown as jest.Mock).mock.calls[0]
    const blob = call[0] as Blob
    const filename = call[1] as string
    const content = await readBlobAsText(blob)

    expect(filename).toBe(expectedFilename)
    expect(content).toMatchSnapshot()

    const snapshotPath = path.join(
      __dirname,
      '__file_snapshots__',
      `save_track_data.${ext}`,
    )
    fs.writeFileSync(snapshotPath, content)

    await user.click(await screen.findByText('Close'))
  },
  60000,
)
