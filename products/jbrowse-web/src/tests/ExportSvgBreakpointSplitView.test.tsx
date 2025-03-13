import fs from 'fs'
import path from 'path'

import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import FileSaver from 'file-saver'
import { afterEach, expect, test, vi } from 'vitest'

import { createView, doBeforeEach, setup } from './util'
import breakpointConfig from '../../test_data/breakpoint/config.json'
afterEach(() => {
  cleanup()
})
// @ts-expect-error
global.Blob = (content, options) => ({ content, options })
setup()

const delay = { timeout: 50000 }

test('export svg of breakpoint split view', async () => {
  doBeforeEach(url => require.resolve(`../../test_data/breakpoint/${url}`))
  console.warn = vi.fn()
  const { findByTestId, findAllByText, findByText } =
    await createView(breakpointConfig)

  // the breakpoint split view requires that the view was rendered first,
  // so add an arbitrary delay here. would need refactoring to fix properly
  await new Promise(resolve => setTimeout(resolve, 10000))

  fireEvent.click(await findByTestId('view_menu_icon'))
  fireEvent.click((await findAllByText('Export SVG'))[0]!)
  fireEvent.click(await findByText('Submit'))

  await waitFor(() => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(
    `${dir}/__image_snapshots__/breakpoint_split_view_snapshot.svg`,
    svg,
  )
  expect(svg).toMatchSnapshot()
}, 60000)
