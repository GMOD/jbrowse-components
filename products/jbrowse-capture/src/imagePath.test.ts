import { assertImagePath } from './imagePath.ts'

// puppeteer writes a PNG under any name it does not recognize, so `-o fig.svg`
// used to produce a PNG called fig.svg.
test.each(['fig.svg', 'fig.pdf', 'fig'])('%s is refused', out => {
  expect(() => {
    assertImagePath(out)
  }).toThrow(`--out needs a .png, .jpg, .jpeg or .webp path, got "${out}"`)
})

test.each(['a/fig.png', 'fig.JPG', 'fig.jpeg', 'fig.webp'])(
  '%s is accepted',
  out => {
    expect(() => {
      assertImagePath(out)
    }).not.toThrow()
  },
)
