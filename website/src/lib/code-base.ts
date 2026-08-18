// The hosted JBrowse app that the docs' live links open in.
//
// `JBROWSE_CODE_BASE` (must end in a slash) retargets every one of them at once.
// Plain `process.env` rather than `astro:config` because
// scripts/screenshot-specs.ts imports this from node, outside the Astro build.
export const RELEASED_CODE_BASE = 'https://jbrowse.org/code/jb2/latest/'

// push.yml syncs `main/` from every commit to main (`aws s3 sync --delete`), so
// its bundled `test_data/` is this repo's, and its app is the one the figures
// were rendered against.
//
// That is why it, and not `latest/`, is the default. A figure's live link opens
// `<base>?config=test_data/…`, and the released build only carries the
// test_data of its own release: measured against v4.3.0 (May 2026), 20 of the 38
// configs the specs name 404 there, which is ~50 figures whose "Open this view
// in JBrowse" lands on a config-not-found page. The graph-genome-view figures
// cannot be fixed by hosting a config either — the plugin reads `createSvgIcon`
// off the host (#5607, unreleased), so on `latest` it throws before the view
// exists. `pnpm check-live-configs --network` is what re-checks this; a release
// that carries both is free to move the default back.
export const MAIN_CODE_BASE = 'https://jbrowse.org/code/jb2/main/'

export const CODE_BASE = process.env.JBROWSE_CODE_BASE || MAIN_CODE_BASE

// A spec's live destination is either an absolute URL of its own or a bare
// `?config=…&session=…` query, which opens identically on whichever hosted build
// CODE_BASE names. The node side (screenshot-specs.ts, video-specs.ts) and the
// Astro side (the remark plugins, reading liveLinks.generated.ts) both resolve
// through this, so `JBROWSE_CODE_BASE` retargets the generated links and the
// freshly computed ones the same way.
export function liveHref(ref: string) {
  return ref.startsWith('http') ? ref : `${CODE_BASE}${ref}`
}

// Point a hand-written `.../code/jb2/latest/...` URL at CODE_BASE, so the prose
// "Live demo" links retarget with the generated figure links rather than being
// the one kind of link left on a build that may not carry what the page
// describes. Links pinned to some other build are left alone.
export function retargetCodeBase(url: string) {
  return url.startsWith(RELEASED_CODE_BASE)
    ? `${CODE_BASE}${url.slice(RELEASED_CODE_BASE.length)}`
    : url
}

// The same retarget for raw doc markdown (the copy button and the `dist/docs/
// <slug>.md` files behind /llms.txt), which never goes through the remark
// pipeline. Only link destinations — inline `](url)` and `[ref]: url`, mirroring
// absolutize-markdown-links.ts — so a URL written out inside a code fence
// (urlparams.md's examples) stays exactly as the reader is told to type it.
export function retargetCodeBaseInMarkdown(markdown: string) {
  return CODE_BASE === RELEASED_CODE_BASE
    ? markdown
    : markdown
        .replaceAll(`](${RELEASED_CODE_BASE}`, `](${CODE_BASE}`)
        .replaceAll(`]: ${RELEASED_CODE_BASE}`, `]: ${CODE_BASE}`)
}
