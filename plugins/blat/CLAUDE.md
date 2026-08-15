# BLAT plugin

Bundled in **jbrowse-desktop only** — BLAT is niche and web pays for it in
cold-load bundle size. The access model (Turnstile, `apiKey`, the CORS split
between proxy and desktop bridge) is documented at each site;
`liveBlat.test.ts`'s header covers why that test is skipped unconditionally.

Two facts not in the source: UCSC caps a key at **5000 hits/day** on top of the
1-per-15s rate limit, and a junk-prefixed query's soft clip comes back a base or
two shorter than the junk — BLAT extends a block through matching junk bases,
which is its call, not the conversion's.

**One assumption never confirmed against a live keyed query: that hgBlat's
`output=json` answers a no-match with an empty `blat` array** rather than a kent
errAbort page. Everything downstream reads a zero-hit result as an answer — the
dialog's "No BLAT hits found", and the proxy relaying JSON through while
rejecting _any_ HTML as a bad key. Were it an errAbort, an ordinary empty search
would surface as "the apiKey may be invalid or rate-limited". hgPcr is the
confirmed case and goes the other way.
