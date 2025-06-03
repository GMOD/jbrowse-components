import { render } from '@testing-library/react'
import { LocalFile } from 'generic-filehandle2'

import { handleRequest } from './generateReadBuffer'
import { App } from './loaderUtil'
import { expectCanvasMatch, setup } from './util'
setup()

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

jest.mock('../makeWorkerInstance', () => () => {})

const delay = { timeout: 20000 }

jest.spyOn(global, 'fetch').mockImplementation(async (url, args) => {
  return `${url}`.includes('jb2=true')
    ? new Response('{}')
    : handleRequest(() => getFile(`${url}`), args)
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// onAction listener warning
console.warn = jest.fn()

test('horizontally flipped inverted alignment', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
            { loc: 'chr1:316,306..316,364', assembly: 'grape' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('regular orientation inverted alignment', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
            { loc: 'chr1:316,306..316,364', assembly: 'grape' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('regular orientation inverted alignment bottom', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
            { loc: 'chr1:316,306..316,364[rev]', assembly: 'grape' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('regular orientation both horizontally flipped', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
            { loc: 'chr1:316,306..316,364[rev]', assembly: 'grape' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('switch rows regular orientation both horizontally flipped', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'chr1:316,306..316,364', assembly: 'grape' },
            { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('switch rows regular orientation both horizontally flipped rev 1', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'chr1:316,306..316,364[rev]', assembly: 'grape' },
            { loc: 'Pp01:28,845,211..28,845,272', assembly: 'peach' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('switch rows regular orientation both horizontally flipped rev2', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'chr1:316,306..316,364', assembly: 'grape' },
            { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)

test('switch rows regular orientation both horizontally flipped both rev', async () => {
  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views: [
            { loc: 'chr1:316,306..316,364[rev]', assembly: 'grape' },
            { loc: 'Pp01:28,845,211..28,845,272[rev]', assembly: 'peach' },
          ],
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}, 40000)
