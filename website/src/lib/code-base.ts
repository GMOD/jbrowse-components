// The hosted JBrowse app that the docs' live links open in.
//
// `JBROWSE_CODE_BASE` (must end in a slash) retargets every one of them at once:
// deploy_staging.sh points staged docs at `main/`, whose app matches the docs
// being staged, while production keeps the released `latest/`. Plain `process.env`
// rather than `astro:config` because scripts/screenshot-specs.ts imports this
// from node, outside the Astro build.
export const RELEASED_CODE_BASE = 'https://jbrowse.org/code/jb2/latest/'

export const CODE_BASE = process.env.JBROWSE_CODE_BASE || RELEASED_CODE_BASE

// Point a hand-written `.../code/jb2/latest/...` URL at CODE_BASE, so the prose
// "Live demo" links retarget with the generated figure links instead of stranding
// a staged page on the released build. A no-op in production, where CODE_BASE is
// the released base; links pinned to some other build are left alone.
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
