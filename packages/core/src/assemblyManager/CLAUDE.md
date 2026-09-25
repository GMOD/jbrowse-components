# Assembly manager

- **Don't design for an assembly config edited in place.** The Assembly Editor
  can do it, but it is rare, and a page reload picks up the change. A loaded
  assembly keeps its regions, aliases and refName maps until then; a reload
  reaction and load epoch for this were built and taken back out.
