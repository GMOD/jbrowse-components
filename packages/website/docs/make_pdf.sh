for i in title.md user*.md config*.md developer*.md; do
  tail -n +5 $i; # trim off the header of the docusaurus md files
done|pandoc title.md - --toc -o jbrowse.pdf
