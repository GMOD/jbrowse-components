import { exportViewSvg } from './exportViewSvg.ts'
import { saveSvgAsImage } from './saveSvgAsImage.ts'

jest.mock('./saveSvgAsImage.ts', () => ({
  saveSvgAsImage: jest.fn(),
}))

beforeEach(() => {
  jest.mocked(saveSvgAsImage).mockClear()
})

test('an export aborted during its render saves nothing and rejects', async () => {
  const controller = new AbortController()
  const exported = exportViewSvg(
    {},
    { signal: controller.signal },
    async () => ({
      renderToSvg: async () => {
        controller.abort()
        return '<svg/>'
      },
    }),
  )

  await expect(exported).rejects.toMatchObject({ name: 'AbortError' })
  expect(saveSvgAsImage).not.toHaveBeenCalled()
})

test('an export left alone saves its render', async () => {
  const exported = exportViewSvg({}, {}, async () => ({
    renderToSvg: async () => '<svg/>',
  }))

  await expect(exported).resolves.toBe('<svg/>')
  expect(saveSvgAsImage).toHaveBeenCalledWith('<svg/>', {})
})
