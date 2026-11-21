import { loadScript } from './loadScript.ts'

function scriptsFor(src: string) {
  return [...document.head.querySelectorAll('script')].filter(
    script => script.src === src,
  )
}

test('concurrent loads of one script add one tag', async () => {
  const src = 'https://example.com/once.js'
  const first = loadScript(src)
  const second = loadScript(src)

  expect(scriptsFor(src)).toHaveLength(1)
  scriptsFor(src)[0]!.dispatchEvent(new Event('load'))
  await expect(Promise.all([first, second])).resolves.toEqual([
    undefined,
    undefined,
  ])
})

test('a failed load removes its tag and lets the next call retry', async () => {
  const src = 'https://example.com/flaky.js'
  const failed = loadScript(src)
  scriptsFor(src)[0]!.dispatchEvent(new Event('error'))
  await expect(failed).rejects.toThrow(`Failed to load ${src}`)
  expect(scriptsFor(src)).toHaveLength(0)

  const retried = loadScript(src)
  expect(scriptsFor(src)).toHaveLength(1)
  scriptsFor(src)[0]!.dispatchEvent(new Event('load'))
  await expect(retried).resolves.toBeUndefined()
})
