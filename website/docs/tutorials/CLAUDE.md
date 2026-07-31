Aim to show (using interesting informative generate-screenshots specs) rather
than tell (reduce extended prose to minimum)

Avoid reference to specific detailed numeric values (bp ranges, track scores,
etc) in prose, as these are difficult to verify unless they are programmatically
derived.

Every tutorial with real requirements has a `## Prerequisites` section directly
under the TL;DR, before any intro prose, listing what the reader must have
before starting: a JBrowse instance, files to download, tools to install, or a
pipeline to run. It is the first thing someone deciding between tutorials needs,
and a title cannot carry it. A page whose whole requirement is "nothing to
install" needs no such section.

That section is a bulleted list and nothing else, in a dry register. At most a
four-word scoping line above it ("To build the tracks:") and an install hint
below it (`apt install ...`). The tutorial's intro goes under its own `##`
heading, never trailing the list: the on-page TOC anchors everything up to the
next heading, so prose left there files a whole introduction under
"Prerequisites".

Don't sell the hosted data. "Nothing to install", "reading needs only a
browser", "every figure has an Open this view link that loads the finished
tracks" is padding, and it is already handled: each figure carries its own live
link plus a "do it yourself" recipe of the menu steps that produced it, and
`quickstart_desktop.md` documents the mechanism once. Say what the reader needs
and what each step does, and let the screenshots carry the rest.
