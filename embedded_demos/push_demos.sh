
#!/bin/bash
for i in jbrowse-react*; do cd $i; git add yarn.lock; git push; cd -; done;
