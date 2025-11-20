import { fireEvent } from '@testing-library/react'

import { createView, doBeforeEach, exportAndVerifySvg, setup } from './util'
import breakpointConfig from '../../test_data/breakpoint/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

const delay = { timeout: 50000 }

test('export svg of breakpoint split view', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
  console.warn = jest.fn()
  const { findByTestId, findAllByText, findByText } =
    await createView(breakpointConfig)

  await new Promise(resolve => setTimeout(resolve, 10000))

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click((await findAllByText('Export SVG'))[0]!)
  fireEvent.click(await findByText('Submit'))

  await exportAndVerifySvg(
    findByTestId,
    findByText,
    'breakpoint_split_view',
    delay,
  )
}, 60000)
