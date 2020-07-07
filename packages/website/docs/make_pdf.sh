for i in title.md $(node read_sidebar.js); do
  tail -n +5 $i; # trim off the header of the docusaurus md files
done|pandoc title.md - --toc -o jbrowse.pdf
