/**
 * Where the density sidecar for a data file lives: `<file>.density.bw`, with a
 * `.gz`/`.bgz` stripped first so `genes.gff3.gz` yields `genes.gff3.density.bw`
 * rather than a name carrying the compression of a file it is not compressed
 * like.
 *
 * One rule, two commands: `make-density` writes here by default and `add-track`
 * probes here, so a sidecar built with no `--out` is the one the track picks up.
 */
export function densitySidecarPath(file: string) {
  return `${file.replace(/\.b?gz$/i, '')}.density.bw`
}
