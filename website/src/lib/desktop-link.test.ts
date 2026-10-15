import { desktopLinkHtml } from './desktop-link.ts'

const webUrl =
  'https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&loc=ctgA:1-100'
const desktopUrl = `jbrowse://open?url=${encodeURIComponent(webUrl)}`

const idOf = (html: string) => /popovertarget="([^"]+)"/.exec(html)?.[1]

test('the control opens a popover holding the link and the url to paste', () => {
  const html = desktopLinkHtml({ webUrl, desktopUrl, label: 'Open ↗' })
  expect(html).toContain(`id="${idOf(html)}" popover`)
  expect(html).toContain(`href="${desktopUrl}"`)
  expect(html).toContain(
    `<pre><code>${webUrl.replaceAll('&', '&amp;')}</code></pre>`,
  )
  expect(html).toContain('Open JBrowse Web link...')
})

test('one link gets one id on every build, and another link another', () => {
  const id = (url: string) =>
    idOf(desktopLinkHtml({ webUrl, desktopUrl: url, label: 'x' }))
  expect(id(desktopUrl)).toBe(id(desktopUrl))
  expect(id(desktopUrl)).not.toBe(id(`${desktopUrl}2`))
})
