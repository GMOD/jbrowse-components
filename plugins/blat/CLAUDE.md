# BLAT plugin

Bundled in **jbrowse-desktop only** — BLAT is niche and web pays for it in
cold-load bundle size. The access model (Turnstile, `apiKey`, the CORS split
between proxy and desktop bridge) is documented at each site;
`liveBlat.test.ts`'s header covers why that test is skipped unconditionally.

Two facts not in the source: UCSC caps a key at **5000 hits/day** on top of the
1-per-15s rate limit, and a junk-prefixed query's soft clip comes back a base or
two shorter than the junk — BLAT extends a block through matching junk bases,
which is its call, not the conversion's.

hgBlat answers a no-match with `"blat": []` (confirmed through the proxy
2026-09-02 with a random 40-mer against hg38): a zero-hit result is an answer,
so the dialog's "No BLAT hits found" and the proxy's any-HTML-is-a-bad-key rule
are both sound. hgPcr is the one that answers "No matches" as an HTML page.
