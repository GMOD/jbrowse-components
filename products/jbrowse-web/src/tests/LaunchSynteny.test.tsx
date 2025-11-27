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

console.warn = jest.fn()

async function testSyntenyView(
  peachLoc: string,
  grapeLoc: string,
  swapped = false,
) {
  const views = swapped
    ? [
        { loc: grapeLoc, assembly: 'grape' },
        { loc: peachLoc, assembly: 'peach' },
      ]
    : [
        { loc: peachLoc, assembly: 'peach' },
        { loc: grapeLoc, assembly: 'grape' },
      ]

  const str = `?config=test_data%2Fgrape_peach_synteny%2Fconfig.json&session=spec-${JSON.stringify(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          tracks: ['subset'],
          views,
        },
      ],
    },
  )}`
  const { findByTestId } = render(<App search={str} />)
  expectCanvasMatch(await findByTestId('synteny_canvas', {}, delay))
}

test('horizontally flipped inverted alignment', async () => {
  await testSyntenyView('Pp01:28,845,211..28,845,272[rev]', 'chr1:316,306..316,364')
}, 40000)

test('regular orientation inverted alignment', async () => {
  await testSyntenyView('Pp01:28,845,211..28,845,272', 'chr1:316,306..316,364')
}, 40000)

test('regular orientation inverted alignment bottom', async () => {
  await testSyntenyView('Pp01:28,845,211..28,845,272', 'chr1:316,306..316,364[rev]')
}, 40000)

test('regular orientation both horizontally flipped', async () => {
  await testSyntenyView(
    'Pp01:28,845,211..28,845,272[rev]',
    'chr1:316,306..316,364[rev]',
  )
}, 40000)

test('switch rows regular orientation both horizontally flipped', async () => {
  await testSyntenyView('Pp01:28,845,211..28,845,272', 'chr1:316,306..316,364', true)
}, 40000)

test('switch rows regular orientation both horizontally flipped rev 1', async () => {
  await testSyntenyView(
    'Pp01:28,845,211..28,845,272',
    'chr1:316,306..316,364[rev]',
    true,
  )
}, 40000)

test('switch rows regular orientation both horizontally flipped rev2', async () => {
  await testSyntenyView(
    'Pp01:28,845,211..28,845,272[rev]',
    'chr1:316,306..316,364',
    true,
  )
}, 40000)

test('switch rows regular orientation both horizontally flipped both rev', async () => {
  await testSyntenyView(
    'Pp01:28,845,211..28,845,272[rev]',
    'chr1:316,306..316,364[rev]',
    true,
  )
}, 40000)
