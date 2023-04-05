import React from 'react'
import { render } from '@testing-library/react'

import { toMatchImageSnapshot } from 'jest-image-snapshot'
import { LocalFile } from 'generic-filehandle'
import rangeParser from 'range-parser'

// local
import { App } from './loaderUtil'
import { expectCanvasMatch } from './util'

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

const readBuffer = async (url: string, args: RequestInit) => {
  // this is the analytics
  if (url.match(/jb2=true/)) {
    return {
      ok: true,
      async json() {
        return {}
      },
    }
  }
  try {
    const file = getFile(url)
    const maxRangeRequest = 2000000 // kind of arbitrary, part of the rangeParser
    if (args.headers && 'range' in args.headers) {
      const range = rangeParser(maxRangeRequest, args.headers.range)
      if (range === -2 || range === -1) {
        throw new Error(`Error parsing range "${args.headers.range}"`)
      }
      const { start, end } = range[0]
      const len = end - start + 1
      const buf = Buffer.alloc(len)
      const { bytesRead } = await file.read(buf, 0, len, start)
      const stat = await file.stat()
      return new Response(buf.slice(0, bytesRead), {
        status: 206,
        headers: [['content-range', `${start}-${end}/${stat.size}`]],
      })
    }
    const body = await file.readFile()
    return new Response(body, { status: 200 })
  } catch (e) {
    console.error(e)
    return new Response(undefined, { status: 404 })
  }
}

jest.mock('../makeWorkerInstance', () => () => {})

expect.extend({ toMatchImageSnapshot })

const delay = { timeout: 20000 }

// @ts-expect-error
jest.spyOn(global, 'fetch').mockImplementation(readBuffer)

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
