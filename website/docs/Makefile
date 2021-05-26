PANDOC_PATH?=pandoc

SRC := $(shell node read_sidebar.js)
# note: SRC_FILES will include cli.md
SRC_FILES := $(filter-out combined_pdf.md combined.md pdfcombined.md introduction.md, $(SRC))
COMMITSHA := $(shell git rev-parse --short HEAD)

PACKAGE_VERSION := $(shell node -p -e "require('../docusaurus.config.json').customFields.currentVersion")

all: combined.md jbrowse2.pdf

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

combined.md: $(SRC_FILES)
	(echo '---\ntitle: JBrowse 2 combined guide\nid: combined\n---\n\nThis document is a collection of all our documentation. It includes our quick start guide, user guide, configuration guide, CLI guide, developer guide, and FAQ. You can browse the other documents individually, but this page is to help simple ctrl+f searching and easy browsing. You can also download a pdf version of these same docs located at https://jbrowse.org/jb2/jbrowse2.pdf\n\nimport Figure from "./figure"' && for f in $^; do cat $$f | node md_parser.js; done) > $@

clean:
	git clean -fdx .

.PHONY: clean titlerev
