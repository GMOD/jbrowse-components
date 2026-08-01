#!/usr/bin/env python3
"""Build the samples TSV that groups and colors a TCGA cohort's rows.

Output is one row per TCGA sample barcode, which is what a multi-sample variant
track's `samplesTsvLocation` and a multi-row track's row names key on:

    name              histology  er        pr        her2      subtype    stage
    TCGA-3C-AAAU-01A  lobular    positive  positive  negative  HR+/HER2-  X

`histology` and `stage` come from the GDC cases API (`primary_diagnosis` and
`ajcc_pathologic_stage`), which are harmonized fields available for every TCGA
project. `er`/`pr`/`her2` are breast specific and are not harmonized, so they are
read from each case's open-access **Clinical Supplement** XML
(`breast_carcinoma_estrogen_receptor_status` and its PR and HER2-IHC siblings);
`subtype` is derived from those three the way a clinical report reads them, and
is the only computed column here.

For a non-breast project the receptor columns come back `unknown` and only
`histology` and `stage` are useful, which is why `--no-receptors` skips their
1100-file download entirely.

Usage: tcga_clinical_tsv.py PROJECT OUT.tsv [--no-receptors]
"""
import argparse
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

API = "https://api.gdc.cancer.gov"

# Receptor statuses, under the BRCA-specific namespace in the clinical XML. ER and
# PR are immunohistochemistry only. HER2 has two assays, and `her2` resolves to
# the in-situ hybridization result wherever the case has one: ISH is the
# confirmatory test, and an equivocal IHC is exactly what gets sent for it (139
# BRCA cases are equivocal by IHC and negative by ISH). Where only IHC exists, it
# stands.
RECEPTOR_TAGS = {
    "er": "breast_carcinoma_estrogen_receptor_status",
    "pr": "breast_carcinoma_progesterone_receptor_status",
    "her2": "lab_proc_her2_neu_immunohistochemistry_receptor_status",
}

HER2_ISH_TAG = "lab_procedure_her2_neu_in_situ_hybrid_outcome_type"

# Histology strings the GDC reports for breast, collapsed to the distinction the
# figures group by. Everything unmatched is `other`, and a case with both a duct
# and a lobular term is `mixed` rather than being forced into one of them.
HISTOLOGY = [
    ("mixed", ("duct and lobular", "mixed with other")),
    ("ductal", ("duct carcinoma", "ductal carcinoma", "intraductal")),
    ("lobular", ("lobular carcinoma",)),
]


def parse_args(argv):
    p = argparse.ArgumentParser()
    p.add_argument("project")
    p.add_argument("outfile")
    p.add_argument("--no-receptors", action="store_true",
                   help="skip the per-case clinical XMLs (non-breast projects)")
    return p.parse_args(argv)


def post(path, body):
    req = urllib.request.Request(
        f"{API}/{path}",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as fh:
        return json.load(fh)


def cases(project):
    """[(case_submitter_id, [sample barcodes], histology, stage)] for a project."""
    d = post("cases", {
        "filters": {"op": "in", "content": {
            "field": "project.project_id", "value": [project]}},
        "fields": ",".join([
            "submitter_id",
            "samples.submitter_id",
            "samples.sample_type",
            "diagnoses.primary_diagnosis",
            "diagnoses.ajcc_pathologic_stage",
        ]),
        "size": "20000",
    })
    out = []
    for hit in d["data"]["hits"]:
        dx = (hit.get("diagnoses") or [{}])[0]
        # Tumor samples only, and not the `-01Z` shipped-portion barcodes the
        # biospecimen carries alongside the real vials: no assay file names one,
        # so they would be rows a track can never match. A multi-sample variant
        # track warns about every metadata row it cannot find in the VCF, and for
        # BRCA these were half the table.
        barcodes = sorted(
            s["submitter_id"] for s in hit.get("samples", [])
            if "Normal" not in s.get("sample_type", "")
            and not s["submitter_id"].endswith("Z")
        )
        out.append((hit["submitter_id"], barcodes,
                    histology(dx.get("primary_diagnosis", "")),
                    stage(dx.get("ajcc_pathologic_stage", ""))))
    return sorted(out)


def histology(term):
    t = term.lower()
    for label, needles in HISTOLOGY:
        if any(n in t for n in needles):
            return label
    return "unknown" if not t or t == "not reported" else "other"


def stage(term):
    """`Stage IIIA` -> `III`, since the substages split the cohort too finely."""
    m = re.match(r"stage\s+(IV|III|II|IX|I|X|0)", term.strip(), re.I)
    return m.group(1).upper() if m else "unknown"


def clinical_xml_ids(project):
    """{case_submitter_id: file_id} for the per-case clinical supplement XMLs."""
    d = post("files", {
        "filters": {"op": "and", "content": [
            {"op": "in", "content": {
                "field": "cases.project.project_id", "value": [project]}},
            {"op": "in", "content": {"field": "data_type",
                                     "value": ["Clinical Supplement"]}},
            {"op": "in", "content": {"field": "access", "value": ["open"]}},
            {"op": "in", "content": {"field": "file_name",
                                     "value": ["nationwidechildrens.org_clinical*"]}},
        ]},
        "fields": "file_id,file_name",
        "size": "20000",
    })
    ids = {}
    for hit in d["data"]["hits"]:
        # nationwidechildrens.org_clinical.TCGA-BH-A18H.xml
        m = re.search(r"(TCGA-[A-Z0-9]{2}-[A-Z0-9]{4})", hit["file_name"])
        if m:
            ids[m.group(1)] = hit["file_id"]
    return ids


def status(root, tag):
    """One receptor call out of a clinical XML, or `unknown`.

    A tag that is absent, empty, or carries anything but the three real statuses
    (`Indeterminate`, `Not Performed`, ...) reads as unknown rather than as a
    call, so a group in a figure means what it says.
    """
    el = root.find(f".//{{*}}{tag}")
    text = (el.text or "").strip().lower() if el is not None else ""
    return text if text in ("positive", "negative", "equivocal") else "unknown"


def receptors(file_ids):
    """{case_submitter_id: {er, pr, her2}} read from the clinical XMLs.

    The GDC /data endpoint takes a POST of many ids and streams back one tar, so
    the whole project arrives in a few requests rather than one per case.
    """
    import tarfile

    found = {}
    ids = sorted(file_ids.values())
    by_id = {v: k for k, v in file_ids.items()}
    batch = 300
    for i in range(0, len(ids), batch):
        chunk = ids[i:i + batch]
        req = urllib.request.Request(
            f"{API}/data",
            data=json.dumps({"ids": chunk}).encode(),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as fh:
            buf = io.BytesIO(fh.read())
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            for member in tar.getmembers():
                if not member.name.endswith(".xml"):
                    continue
                # GDC lays the tar out as <file_id>/<name>, so the directory
                # recovers which case this is without parsing the name again
                case = by_id.get(member.name.split("/")[0])
                if case is None:
                    continue
                root = ET.fromstring(tar.extractfile(member).read())
                values = {k: status(root, tag) for k, tag in RECEPTOR_TAGS.items()}
                ish = status(root, HER2_ISH_TAG)
                if ish in ("positive", "negative"):
                    values["her2"] = ish
                found[case] = values
        print(f"   receptor status for {len(found)} cases", end="\r", flush=True)
    print()
    return found


def subtype(r):
    """HER2+ / HR+/HER2- / triple-negative, from the three IHC calls.

    HER2 positive wins regardless of hormone receptor status, which is how the
    clinic reads it: HER2 is the actionable call. An equivocal or missing call
    anywhere that would change the answer leaves the tumor `unknown` rather than
    guessing, so a group in a figure means what it says.
    """
    er, pr, her2 = r["er"], r["pr"], r["her2"]
    if her2 == "positive":
        return "HER2+"
    if her2 == "negative":
        if "positive" in (er, pr):
            return "HR+/HER2-"
        if er == "negative" and pr == "negative":
            return "triple-negative"
    return "unknown"


def main(argv):
    args = parse_args(argv)
    rows = cases(args.project)
    if not rows:
        sys.exit(f"{args.project}: no cases returned by the GDC")
    ihc = {} if args.no_receptors else receptors(clinical_xml_ids(args.project))
    blank = {"er": "unknown", "pr": "unknown", "her2": "unknown"}

    written = 0
    with open(args.outfile, "w") as fh:
        fh.write("name\thistology\ter\tpr\ther2\tsubtype\tstage\n")
        for case, barcodes, hist, stg in rows:
            r = ihc.get(case, blank)
            # one row per tumor sample barcode: the assays disagree about which
            # portion of a case they sampled (`-01A` vs `-01Z`), and a samples
            # TSV is joined by barcode, so every barcode the case has needs a row
            for barcode in barcodes:
                fh.write(f"{barcode}\t{hist}\t{r['er']}\t{r['pr']}\t{r['her2']}"
                         f"\t{subtype(r)}\t{stg}\n")
                written += 1
    print(f"   {written} sample rows from {len(rows)} cases -> {args.outfile}")


if __name__ == "__main__":
    main(sys.argv[1:])
