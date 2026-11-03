# BLAT plugin

Bundled in **no product**. It loads from a config's `plugins` entry, which
jb2hubs writes into every genomes.jbrowse.org config, because a search only
works on a UCSC-hosted assembly and a hosted bundle takes a UCSC-side fix
without a JBrowse release. Its UMD build (`plugins/blat/scripts/umdBuild.ts`,
loaded by `plugins/blat/src/umdBundle.test.ts`) is the repo's only
runtime-plugin build.

Every query goes to the server in the dialog, the jbrowse.org proxy
(`products/aws/blat-proxy`) by default, on web and Desktop alike; there is no
direct-to-UCSC path, apiKey field or CAPTCHA window. The bundle must keep
booting v4.3.0, where it installs nothing, since hub configs are loaded there.

Facts not in the source:

- UCSC caps a key at **5000 hits/day**, on top of the 1-per-15s rate limit.
- BLAT extends a block through matching junk bases, so a junk-prefixed query's
  soft clip comes back a base or two shorter than the junk. The conversion is
  right.
- hgBlat answers no match with `"blat": []`, so a zero-hit result is an answer
  and the proxy's any-HTML-is-a-bad-key rule holds. hgPcr answers "No matches"
  as an HTML page.
