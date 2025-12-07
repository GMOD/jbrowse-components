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

const trackTestCases = [
  ['VCF', 'volvox_filtered_vcf', 'jbrowse_track_data.vcf'],
  ['BAM', 'volvox_bam', 'jbrowse_track_data.sam'],
  ['CRAM', 'volvox_cram', 'jbrowse_track_data.sam'],
  ['GFF', 'gff3tabix_genes', 'jbrowse_track_data.gff3'],
  ['BED', 'bedtabix_genes', 'jbrowse_track_data.gff3'],
  ['BigWig', 'volvox_microarray', 'jbrowse_track_data.bedgraph'],
] as const

test.each(trackTestCases)(
  'save track data for %s track',
  async (_, trackId, expectedFilename) => {
    const user = userEvent.setup()
    const { view } = await createView()
    view.setNewView(0.05, 5000)

    await openSaveTrackDataDialog(user, trackId)

    expect(await screen.findByText('File type', ...opts)).toBeTruthy()

    await user.click(await screen.findByText('Download'))

    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    const call = (saveAs as unknown as jest.Mock).mock.calls[0]
    const blob = call[0] as Blob
    const filename = call[1] as string
    const content = await readBlobAsText(blob)

    expect(filename).toBe(expectedFilename)
    expect(content).toMatchSnapshot()

    await user.click(await screen.findByText('Close'))
  },
  60000,
)
