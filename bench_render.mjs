import puppeteer from 'puppeteer'
import fs from 'fs'
;(async () => {
  const timeoutToken = process.argv[3] + '.timeout'
  // if (checkFileExistsSync(timeoutToken)) {
  //   throw new Error('Timed out already')
  // }
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()
  await page.goto(process.argv[2])

  const params = new URL(process.argv[2]).searchParams
  const tracks = params.get('tracks')
  if (!tracks) {
    throw new Error('no tracks')
  }
  const n = tracks.split(',').length
  const nblocks = 2 * n
  try {
    await page.evaluate(() => {
      // @ts-expect-error
      window.fps = []

      let LAST_FRAME_TIME = 0
      function measure(TIME) {
        // @ts-expect-error
        window.fps.push(1 / ((performance.now() - LAST_FRAME_TIME) / 1000))
        LAST_FRAME_TIME = TIME
        window.requestAnimationFrame(measure)
      }
      window.requestAnimationFrame(measure)
    })
    await page.waitForFunction(
      nblocks =>
        document.querySelectorAll('[data-testid="pileup-overlay-normal"]')
          .length === nblocks &&
        document.querySelectorAll('[data-testid="wiggle-rendering-test"]')
          .length == nblocks,
      { timeout: 300000 },
      nblocks,
    )

    // const fps = await page.evaluate(() => JSON.stringify(window.fps))

    // fs.appendFileSync(process.argv[3], fps + '\n')
    // fs.appendFileSync(
    //   process.argv[4],
    //   JSON.stringify(await page.metrics()) + '\n',
    // )
    // await page.screenshot({ path: process.argv[3] + '.png' })
  } catch (e) {
    fs.appendFileSync(timeoutToken, '')
  }

  await browser.close()
  process.exit(0)
})()
