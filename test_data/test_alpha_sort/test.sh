for i in {a..e}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i toplevel"; done;
for i in {a..e}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat1" --category cat1; done;
for i in {a..e}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat1 cat2" --category cat1,cat2; done;
for i in {a..e}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat3" --category cat3; done;
for i in {a..e}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat3 cat4" --category cat3,cat4; done;
for i in {f..j}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i toplevel"; done;
for i in {f..j}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat1" --category cat1; done;
for i in {f..j}; do echo $i; jbrowse add-track a.bam --load inPlace --out test_alpha_sort --trackId "$i cat1 cat2" --category cat1,cat2; done;
