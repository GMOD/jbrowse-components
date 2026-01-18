#!/bin/bash
#
# plink2ld.sh - Convert PLINK --r2 output to indexed LD format for JBrowse
#
# Usage:
#   plink2ld.sh input.ld output.ld.gz
#
# Or generate from VCF:
#   plink2ld.sh --vcf input.vcf.gz output.ld.gz [plink options]
#
# Requirements: plink (if using --vcf), bgzip, tabix
#

set -e

usage() {
    echo "Usage: $0 input.ld output.ld.gz"
    echo "       $0 --vcf input.vcf.gz output.ld.gz [plink options]"
    echo ""
    echo "Convert PLINK LD output to indexed format for JBrowse LDTrack."
    echo ""
    echo "Options:"
    echo "  --vcf     Generate LD from VCF file using PLINK"
    echo "  --help    Show this help message"
    echo ""
    echo "Examples:"
    echo "  # From existing PLINK .ld file:"
    echo "  $0 plink.ld mydata.ld.gz"
    echo ""
    echo "  # From VCF (computes LD with PLINK):"
    echo "  $0 --vcf variants.vcf.gz mydata.ld.gz --ld-window-kb 1000"
    echo ""
    echo "Note: For small files, JBrowse can also load plain .ld files directly"
    echo "      without indexing (PlinkLDAdapter loads the entire file into memory)."
    exit 1
}

check_deps() {
    local missing=()
    command -v bgzip >/dev/null 2>&1 || missing+=("bgzip (from htslib)")
    command -v tabix >/dev/null 2>&1 || missing+=("tabix (from htslib)")

    if [ ${#missing[@]} -ne 0 ]; then
        echo "Error: Missing required tools: ${missing[*]}" >&2
        exit 1
    fi
}

from_vcf() {
    local vcf="$1"
    local output="$2"
    shift 2
    local plink_opts="$@"

    command -v plink >/dev/null 2>&1 || {
        echo "Error: plink not found. Install PLINK to generate LD from VCF." >&2
        exit 1
    }

    local tmpdir=$(mktemp -d)
    trap "rm -rf $tmpdir" EXIT

    echo "Computing LD from VCF with PLINK..."
    plink --vcf "$vcf" \
          --r2 \
          --ld-window-r2 0 \
          --out "$tmpdir/ld" \
          $plink_opts

    from_ld "$tmpdir/ld.ld" "$output"
}

from_ld() {
    local input="$1"
    local output="$2"

    if [ ! -f "$input" ]; then
        echo "Error: Input file not found: $input" >&2
        exit 1
    fi

    echo "Processing PLINK LD file..."

    # Check if file has header
    local first_line=$(head -1 "$input")
    local has_header=false
    if [[ "$first_line" == *"CHR_A"* ]] || [[ "$first_line" == *"CHR1"* ]]; then
        has_header=true
    fi

    local tmpfile=$(mktemp)
    trap "rm -f $tmpfile" EXIT

    if [ "$has_header" = true ]; then
        # Keep header, sort rest by CHR_A and BP_A
        head -1 "$input" > "$tmpfile"
        tail -n +2 "$input" | sort -k1,1V -k2,2n >> "$tmpfile"
    else
        # Add header and sort
        echo -e "CHR_A\tBP_A\tSNP_A\tCHR_B\tBP_B\tSNP_B\tR2" > "$tmpfile"
        sort -k1,1V -k2,2n "$input" >> "$tmpfile"
    fi

    # Convert spaces to tabs if needed, bgzip
    echo "Compressing..."
    sed 's/  */\t/g' "$tmpfile" | bgzip -c > "$output"

    # Create tabix index (CHR_A is col 1, BP_A is col 2)
    echo "Indexing..."
    tabix -s1 -b2 -e2 -S1 "$output"

    echo "Done! Created:"
    echo "  $output"
    echo "  ${output}.tbi"
}

# Main
check_deps

if [ $# -lt 2 ]; then
    usage
fi

case "$1" in
    --help|-h)
        usage
        ;;
    --vcf)
        if [ $# -lt 3 ]; then
            usage
        fi
        from_vcf "$2" "$3" "${@:4}"
        ;;
    *)
        from_ld "$1" "$2"
        ;;
esac
