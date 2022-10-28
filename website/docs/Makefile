PANDOC_PATH?=pandoc

SRC := $(shell node read_sidebar.js)
# note: SRC_FILES will include cli.md
SRC_FILES := $(filter-out combined_pdf.md pdfcombined.md introduction.md, $(SRC))
COMMITSHA := $(shell git rev-parse --short HEAD)

PACKAGE_VERSION := $(shell node -p -e "require('../docusaurus.config.json').customFields.currentVersion")

all: jbrowse2.pdf

pdfcombined.md: $(SRC_FILES)
	for f in $^; do cat $$f | node tex_parser.js; done > $@

titlerev: title_rev_$(COMMITSHA).md

title_rev_$(COMMITSHA).md: title.md
	echo $(PACKAGE_VERSION)
	cat $< | sed -e 's/git-commit-sha/git revision $(COMMITSHA)/' | sed -e 's/jbrowse-version/$(PACKAGE_VERSION)/'  > $@

jbrowse2.pdf: pdfcombined.md disable_float.tex title_rev_$(COMMITSHA).md listings.tex
	$(PANDOC_PATH) $(PANDOC_OPTS) -H disable_float.tex title_rev_$(COMMITSHA).md pdfcombined.md --listings -H listings.tex  --toc -o $@

cli.md: ../../products/jbrowse-cli/README.md
	cp $^ $@

clean:
	git clean -fdx .

.PHONY: clean titlerev
