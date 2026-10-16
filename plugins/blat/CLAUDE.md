# BLAT plugin

Bundled in **jbrowse-desktop only**: BLAT is niche, and web would pay for it in
cold-load bundle size.

Facts not in the source:

- UCSC caps a key at **5000 hits/day**, on top of the 1-per-15s rate limit.
- BLAT extends a block through matching junk bases, so a junk-prefixed query's
  soft clip comes back a base or two shorter than the junk. The conversion is
  right.
- hgBlat answers no match with `"blat": []`, so a zero-hit result is an answer
  and the proxy's any-HTML-is-a-bad-key rule holds. hgPcr answers "No matches"
  as an HTML page.
