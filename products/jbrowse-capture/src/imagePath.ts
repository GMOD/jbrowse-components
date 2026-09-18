// The types puppeteer infers from a path; it writes a PNG under any other name.
const IMAGE_EXTENSION = /\.(png|jpe?g|webp)$/i

export function assertImagePath(out: string) {
  if (!IMAGE_EXTENSION.test(out)) {
    throw new Error(
      `--out needs a .png, .jpg, .jpeg or .webp path, got "${out}" ` +
        '(for SVG, @jbrowse/img renders one without a browser)',
    )
  }
}
