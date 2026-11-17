import { fireEvent, waitFor, within } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import {
  createView,
  doBeforeEach,
  findAnyDisplayPainted,
  generateReadBuffer,
  hts,
  mockConsole,
  volvoxConfigWithTracks,
} from './util.tsx'

const delay = { timeout: 30000 }

const trackId = 'volvox_filtered_vcf'

const config = volvoxConfigWithTracks([trackId])

const readBuffer = generateReadBuffer(
  url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
)

function failWith(failingFile: string, status: number) {
  fetchMock.mockResponse(async request =>
    request.url.includes(failingFile) ? { status } : readBuffer(request),
  )
}

async function openTrack(trackConfig: unknown) {
  const ret = await createView(trackConfig)
  ret.view.setNewView(0.05, 5000)
  fireEvent.click(await ret.findByTestId(hts(trackId), {}, delay))
  return ret
}

beforeEach(() => {
  doBeforeEach()
})

test('a missing index offers Fix file location, whose Save writes the index location and reloads', async () => {
  await mockConsole(async () => {
    failWith('volvox.filtered.vcf.gz.moved.tbi', 404)
    const [track] = config.tracks
    const moved = {
      ...config,
      tracks: [
        {
          ...track,
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: {
              uri: 'volvox.filtered.vcf.gz',
              locationType: 'UriLocation',
            },
            index: {
              location: {
                uri: 'volvox.filtered.vcf.gz.moved.tbi',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
    }
    const { findByText, findByTestId, queryByTestId, session } =
      await openTrack(moved)
    await findByText(
      /^The index \S*volvox\.filtered\.vcf\.gz\.moved\.tbi was not found \(HTTP 404\): set the track's index location/,
      {},
      delay,
    )
    const button = await findByTestId('file_fix_button', {}, delay)
    expect(button.textContent).toBe('Fix file location...')
    fireEvent.click(button)

    const dialog = within(await findByTestId('track_files_dialog', {}, delay))
    dialog.getByText('vcfGzLocation')
    dialog.getByText('index location')
    const [, indexInput] = dialog.getAllByTestId('urlInput')
    fireEvent.change(indexInput!, {
      target: { value: 'volvox.filtered.vcf.gz.tbi' },
    })
    fireEvent.click(dialog.getByText('Save'))

    await findAnyDisplayPainted(delay)
    expect(queryByTestId('file_fix_button')).toBeNull()
    await waitFor(() => {
      expect(JSON.stringify(session.trackConfigDeltas[trackId])).toContain(
        '"uri":"volvox.filtered.vcf.gz.tbi"',
      )
    })
  })
}, 40000)

test('an error the settings cannot fix keeps the bar it had', async () => {
  await mockConsole(async () => {
    failWith('volvox.filtered.vcf.gz.tbi', 500)
    const { findAllByText, findByTestId, queryByTestId } =
      await openTrack(config)
    await findAllByText(
      /HTTP 500 fetching \S*volvox\.filtered\.vcf\.gz\.tbi/,
      {},
      delay,
    )
    await findByTestId('reload_button', {}, delay)
    expect(queryByTestId('file_fix_button')).toBeNull()
  })
}, 40000)

test('a file opened locally in an earlier session offers Choose the file again, listing both files', async () => {
  await mockConsole(async () => {
    const [track] = config.tracks
    const local = {
      ...config,
      tracks: [
        {
          ...track,
          adapter: {
            type: 'VcfTabixAdapter',
            vcfGzLocation: {
              locationType: 'BlobLocation',
              name: 'volvox.filtered.vcf.gz',
              blobId: 'b-from-an-earlier-session',
            },
            index: {
              location: {
                locationType: 'BlobLocation',
                name: 'volvox.filtered.vcf.gz.tbi',
                blobId: 'b-index-from-an-earlier-session',
              },
            },
          },
        },
      ],
    }
    const { findAllByText, findByTestId } = await openTrack(local)
    await findAllByText(/was opened locally from a previous session/, {}, delay)
    const button = await findByTestId('file_fix_button', {}, delay)
    expect(button.textContent).toBe('Choose the file again...')
    fireEvent.click(button)

    const dialog = within(await findByTestId('track_files_dialog', {}, delay))
    expect(dialog.getAllByText('(need to reload)')).toHaveLength(2)
    fireEvent.click(dialog.getByText('All settings...'))
    await findByTestId('configEditor', {}, delay)
  })
}, 40000)
