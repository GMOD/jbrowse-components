# BLAT plugin

Bundled in **jbrowse-desktop only** — BLAT is niche and web pays for it in
cold-load bundle size. The access model (Turnstile, `apiKey`, the CORS split
between the proxy and the desktop bridge) is documented at each site;
`liveBlat.test.ts`'s header covers why that test is skipped unconditionally.

Two things not stated in the source: UCSC caps a key at **5000 hits/day** on top
of the 1-per-15s rate limit, and in a live run the junk-prefixed query's soft
clip comes back a base or two shorter than the junk — BLAT extends a block
through junk bases that happen to match, which is its call, not the
conversion's.
