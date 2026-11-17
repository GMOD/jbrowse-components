import { fireEvent } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import {
  createView,
  doBeforeEach,
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

test('a missing index names its URL, and Edit track opens the track settings', async () => {
  await mockConsole(async () => {
    failWith('volvox.filtered.vcf.gz.tbi', 404)
    const { findByText, findByTestId } = await openTrack(config)
    await findByText(
      /^The index \S*volvox\.filtered\.vcf\.gz\.tbi was not found \(HTTP 404\): set the track's index location/,
      {},
      delay,
    )
    fireEvent.click(await findByTestId('edit_track_button', {}, delay))
    await findByTestId('configEditor', {}, delay)
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
    expect(queryByTestId('edit_track_button')).toBeNull()
  })
}, 40000)

test('a file opened locally in an earlier session offers Edit track', async () => {
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
    fireEvent.click(await findByTestId('edit_track_button', {}, delay))
    await findByTestId('configEditor', {}, delay)
  })
}, 40000)
