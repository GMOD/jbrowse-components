import { browser } from '@wdio/globals'

describe('Electron Testing', () => {
  it('should print application title', async () => {
    const r = await browser.getTitle()
    expect(r).toBe('Electron')
  })
})
