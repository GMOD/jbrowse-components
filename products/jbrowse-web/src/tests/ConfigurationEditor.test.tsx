/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React from 'react'
import '@testing-library/jest-dom/extend-expect'
import { fireEvent, waitFor } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { createView, generateReadBuffer } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

test('change color on track', async () => {
  const { view, getByTestId, findByTestId, findByText, findByDisplayValue } =
    createView(undefined, true)
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(
    await findByTestId('htsTrackEntry-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor', {}, delay)
  fireEvent.change(await findByDisplayValue('goldenrod'), {
    target: { value: 'green' },
  })
  await waitFor(
    () =>
      expect(getByTestId('box-test-vcf-604452')).toHaveAttribute(
        'fill',
        'green',
      ),
    delay,
  )
}, 20000)
