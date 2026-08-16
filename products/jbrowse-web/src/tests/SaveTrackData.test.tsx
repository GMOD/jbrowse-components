import fs from 'node:fs'
import path from 'node:path'

import { saveAs } from '@jbrowse/core/util/FileSaver'
import { fireEvent, screen, waitFor } from '@testing-library/react'

import {
  createView,
  doBeforeEach,
  hts,
  setup,
  volvoxConfigWithTracks,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => {
  return {
    ...jest.requireActual('@jbrowse/core/util/FileSaver'),
    saveAs: jest.fn(),
  }
})

setup()

beforeEach(() => {
  doBeforeEach()
  // this is a false positive
  ;(saveAs as unknown as jest.Mock).mockClear()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

async function openSaveTrackDataDialog(trackId: string) {
  fireEvent.click(await screen.findByTestId(hts(trackId), ...opts))
  fireEvent.click(await screen.findByTestId('track_menu_icon', ...opts))
  fireEvent.click(await screen.findByText('Track actions', ...opts))
  fireEvent.click(await screen.findByText('Save track data', ...opts))
}

test.each([
  ['VCF', 'volvox_filtered_vcf', 'jbrowse_track_data.vcf', 'vcf'],
  ['BAM', 'volvox_bam', 'jbrowse_track_data.sam', 'sam'],
  ['CRAM', 'volvox_cram', 'jbrowse_track_data.sam', 'cram.sam'],
  ['GFF', 'gff3tabix_genes', 'jbrowse_track_data.gff3', 'gff3'],
  ['BED', 'bedtabix_genes', 'jbrowse_track_data.gff3', 'bed.gff3'],
  ['BigWig', 'volvox_microarray', 'jbrowse_track_data.bedgraph', 'bedgraph'],
  ['FASTA', 'volvox_refseq', 'jbrowse_track_data.fa', 'fa'],
])(
  'save track data for %s track',
  async (_, trackId, expectedFilename, ext) => {
    // volvox_refseq is the assembly's own sequence track rather than a member
    // of config.tracks, so it is in the selector whatever `tracks` holds and
    // there is nothing to keep for it.
    const { view } = await createView(
      volvoxConfigWithTracks(trackId === 'volvox_refseq' ? [] : [trackId]),
    )
    await view.navToLocString('ctgA:4,318..4,440')

    await openSaveTrackDataDialog(trackId)

    await screen.findByText(/File type/, ...opts)

    // Wait for loading to complete before downloading. Gated on the Download
    // button rather than on the textarea's text: the dialog now shows the
    // fetch's live progress there ("Downloading features 42%"), so a string
    // comparison against the idle label passes on the first progress tick and
    // clicks Download over an empty result. `disabled` is the state the click
    // actually depends on.
    await waitFor(
      async () => {
        const button = (await screen.findByText('Download', ...opts)).closest(
          'button',
        )
        expect(button?.disabled).toBe(false)
      },
      { timeout: 30000 },
    )

    fireEvent.click(await screen.findByText('Download'))

    await waitFor(() => {
      // this is a false positive

      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // this is a false positive

    const call = (saveAs as unknown as jest.Mock).mock.calls[0]
    const blob = call[0] as Blob
    const filename = call[1] as string
    // `config/jest/blob.js` fills `Blob.prototype.text` on jsdom's Blob, which
    // implements only slice/size/type. This used to read node's Blob, which the
    // test environment installed over jsdom's — and that broke jsdom's
    // FileReader for every OTHER export test, since it brand-checks its
    // argument. The shim is what lets both idioms work against one realm.
    const content = await blob.text()

    expect(filename).toBe(expectedFilename)
    expect(content).toMatchSnapshot()

    // For GFF3 tracks, verify that full gene features are exported even when
    // viewing a small region inside the gene (tests redispatch behavior)
    if (ext === 'gff3') {
      // The viewed region ctgA:4,318..4,440 is inside the EDEN gene (1050-9000)
      // Verify the full gene is exported with correct coordinates
      expect(content).toContain('1050\t9000')
      expect(content).toContain('ID=EDEN')
      expect(content).toContain('EDEN.1')
      expect(content).toContain('EDEN.2')
      expect(content).toContain('EDEN.3')

      // Verify CDS features are present, including those outside the viewed
      // region (e.g. 1201-1500 and 7000-7608 are outside ctgA:4,318..4,440)
      expect(content).toContain('CDS\t1201\t1500')
      expect(content).toContain('CDS\t3000\t3902')
      expect(content).toContain('CDS\t3301\t3902')
      expect(content).toContain('CDS\t5000\t5500')
      expect(content).toContain('CDS\t7000\t7600')
      expect(content).toContain('CDS\t7000\t7608')
    }

    const snapshotPath = path.join(
      __dirname,
      '__file_snapshots__',
      `save_track_data.${ext}`,
    )
    fs.writeFileSync(snapshotPath, content)

    fireEvent.click(await screen.findByText('Close'))
  },
  60000,
)

// The dialog pulls the region with the same index estimate the display's gate
// takes, and over budget it downloads nothing until asked twice. Driven from a
// 1-byte adapter limit rather than a large region: volvox has nothing big
// enough, and the budget is the thing being tested either way.
test('a track over its adapter budget asks before downloading', async () => {
  const config = volvoxConfigWithTracks(['volvox_bam'])
  const { view } = await createView({
    ...config,
    tracks: config.tracks.map(t => ({
      ...t,
      adapter: { ...t.adapter, fetchSizeLimit: 1 },
    })),
  })
  await view.navToLocString('ctgA:4,318..4,440')

  await openSaveTrackDataDialog('volvox_bam')

  // the estimate is quoted, and both ways out of the dialog with data are held
  await screen.findByDisplayValue(
    /is an estimated .* over the 1 bytes/,
    ...opts,
  )
  const download = await screen.findByText('Download', ...opts)
  expect(download.closest('button')!.disabled).toBe(true)
  expect(saveAs).not.toHaveBeenCalled()

  fireEvent.click(await screen.findByText('Download anyway', ...opts))

  await waitFor(() => {
    expect(download.closest('button')!.disabled).toBe(false)
  }, delay)
  fireEvent.click(download)
  await waitFor(() => {
    expect(saveAs).toHaveBeenCalled()
  }, delay)
}, 60000)
