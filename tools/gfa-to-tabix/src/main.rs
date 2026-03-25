use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};
use std::time::Instant;

use clap::Parser;

/// Converts GFA to tabix-indexed pos.bed.gz + segments.gz files.
///
/// Streaming two-pass approach: O(segments) memory.
/// Segment ordinals are assigned in path-traversal order so that
/// reference-path queries span compact ordinal ranges in segments.gz.
/// List the reference assembly's paths first in the GFA for best performance.
///
/// By default, walks whose segments ALL have opposite orientation to the
/// reference are normalized (orient flipped, offsets reversed). This removes
/// false inversions caused by reverse-complemented assembly contigs while
/// preserving genuine biological inversions. Inspired by odgi groom
/// (https://github.com/pangenome/odgi); for more thorough normalization,
/// preprocess with: odgi groom -R ref_paths.txt
#[derive(Parser)]
#[command(name = "gfa-to-tabix")]
struct Args {
    /// Input GFA file (plain or .gz)
    input_file: String,

    /// Output prefix (default: derived from input filename)
    output_prefix: Option<String>,

    /// Number of walk steps per pos.bed.gz chunk
    #[arg(long, default_value_t = 100)]
    chunk_size: usize,

    /// Comma-separated list of assemblies to include
    #[arg(long)]
    assemblies: Option<String>,

    /// Produce per-assembly sharded segments files
    #[arg(long)]
    sharded: bool,

    /// Disable orientation normalization of reverse-complemented contigs
    #[arg(long)]
    no_groom: bool,

    /// Assembly name to use as reference for grooming (default: first assembly in GFA).
    /// Should match the assembly used for browsing in JBrowse.
    #[arg(long)]
    ref_assembly: Option<String>,

    /// Generate bubbles BED file from a VCF produced by vg deconstruct.
    /// Computes CS between all allele pairs at each variant site.
    #[arg(long)]
    bubbles: Option<String>,

    /// Write a JBrowse config JSON file with track entries for the generated
    /// GfaTabix multi-synteny track plus (when --bubbles is used) a VCF
    /// variant track pointing at the source VCF.
    #[arg(long)]
    output_config: Option<String>,
}

fn main() {
    let cli = Args::parse();

    let gfa_path = &cli.input_file;

    let output_prefix = cli.output_prefix.unwrap_or_else(|| {
        gfa_path
            .trim_end_matches(".gz")
            .trim_end_matches(".gfa")
            .to_string()
    });

    let chunk_size = cli.chunk_size;
    let assemblies_filter: Option<HashSet<String>> = cli
        .assemblies
        .map(|s| s.split(',').map(|s| s.to_string()).collect());
    let sharded = cli.sharded;
    let groom = !cli.no_groom;
    let ref_assembly_arg = cli.ref_assembly;
    let bubbles_vcf = cli.bubbles;
    let output_config = cli.output_config;

    // Two-phase single-pass: reads all lines once, collecting S-lines in memory
    // and spilling P/W-lines to a temp file. Then replays the temp file to
    // process paths with full segment knowledge. This supports streaming from
    // stdin (vg convert -f input.vg | gfa-to-tabix - output) without buffering
    // large path walks in memory.
    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

    eprintln!("Reading GFA...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;

    // Spool P/W-lines to a temp file to avoid buffering in memory
    let paths_tmp = tmp_dir.join("paths.txt");
    let mut paths_tmp_w = BufWriter::new(File::create(&paths_tmp).expect("create paths tmp"));
    let mut path_line_count: u64 = 0;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");

        if line.starts_with("S\t") {
            let mut parts = line.splitn(4, '\t');
            parts.next();
            let name = parts.next().expect("missing segment name").to_string();
            let seq = parts.next().expect("missing segment sequence");
            let length = parts
                .next()
                .and_then(|rest| {
                    rest.split('\t')
                        .find(|t| t.starts_with("LN:i:"))
                        .map(|t| t[5..].parse::<u64>().unwrap_or(0))
                })
                .unwrap_or_else(|| if seq == "*" { 0 } else { seq.len() as u64 });
            seg_lengths.insert(name, length);
        } else if line.starts_with("W\t") || line.starts_with("P\t") {
            paths_tmp_w.write_all(line.as_bytes()).unwrap();
            paths_tmp_w.write_all(b"\n").unwrap();
            path_line_count += 1;
        }
    }
    drop(paths_tmp_w);

    eprintln!("  {} segments, {} path lines", seg_lengths.len(), path_line_count);

    // Replay buffered path lines now that all segments are known
    eprintln!("Processing paths...");

    let pos_file = format!("{}.pos.bed.gz", output_prefix);
    let mut pos_proc = spawn_sort_bgzip(&pos_file);
    let mut pos_w = BufWriter::new(pos_proc.stdin.take().unwrap());

    let combined_tmp = tmp_dir.join("segments.tsv");
    let mut segments_files: HashMap<String, BufWriter<File>> = HashMap::new();
    if !sharded {
        segments_files.insert(
            String::new(),
            BufWriter::new(File::create(&combined_tmp).expect("create temp")),
        );
    }

    let mut genomes: Vec<String> = Vec::new();
    let mut genome_set: HashSet<String> = HashSet::new();
    let mut ref_orients: HashMap<u64, bool> = HashMap::new();
    let mut ref_assembly: Option<String> = None;
    let mut path_names: Vec<String> = Vec::new();
    let mut path_name_indices: HashMap<String, u64> = HashMap::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;

    for line in BufReader::new(File::open(&paths_tmp).expect("reopen paths tmp")).lines() {
        let line = line.expect("read error");

        let parsed = if line.starts_with("W\t") {
            parse_walk(&line)
        } else if line.starts_with("P\t") {
            parse_p_line(&line)
        } else {
            None
        };

        if let Some((path_name, assembly, seg_str, is_walk)) = parsed {
            if let Some(ref filter) = assemblies_filter {
                if !filter.contains(&assembly) {
                    continue;
                }
            }
            if genome_set.insert(assembly.clone()) {
                genomes.push(assembly.clone());
            }

            let is_ref = match &ref_assembly {
                None => {
                    if let Some(ref ra) = ref_assembly_arg {
                        if *ra == assembly {
                            ref_assembly = Some(assembly.clone());
                            true
                        } else {
                            false
                        }
                    } else {
                        ref_assembly = Some(assembly.clone());
                        true
                    }
                }
                Some(ra) => *ra == assembly,
            };

            let path_index = if let Some(&idx) = path_name_indices.get(&path_name) {
                idx
            } else {
                let idx = path_names.len() as u64;
                path_name_indices.insert(path_name.clone(), idx);
                path_names.push(path_name.clone());
                idx
            };

            let segments_key = if sharded { assembly.clone() } else { String::new() };
            if !segments_files.contains_key(&segments_key) {
                let p = tmp_dir.join(format!("{}.tsv", encode_filename(&assembly)));
                segments_files.insert(
                    segments_key.clone(),
                    BufWriter::new(File::create(&p).expect("create shard temp")),
                );
            }
            let segments_w = segments_files.get_mut(&segments_key).unwrap();

            let total = emit_path_rows(
                &path_name,
                path_index,
                &seg_str,
                is_walk,
                chunk_size,
                &seg_lengths,
                &mut seg_ordinals,
                &mut next_ordinal,
                &mut pos_w,
                segments_w,
                &mut ref_orients,
                is_ref,
                groom,
            );

            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }
    // Clean up paths temp file
    let _ = fs::remove_file(&paths_tmp);
    if let Some(ref ra) = ref_assembly {
        eprintln!("  Reference assembly: {} ({} orient entries)", ra, ref_orients.len());
    }

    // Headers
    let header = format!("#genomes={}\n", genomes.join(","));
    let sizes_str: Vec<String> = path_sizes
        .iter()
        .map(|(n, s)| format!("{}:{}", n, s))
        .collect();
    let sizes_header = format!("#sizes={}\n", sizes_str.join(","));
    let paths_header = format!("#paths={}\n", path_names.join(","));
    let full_header = format!("{}{}{}", header, sizes_header, paths_header);

    // Finish pos.bed.gz
    pos_w.write_all(header.as_bytes()).unwrap();
    pos_w.write_all(sizes_header.as_bytes()).unwrap();
    pos_w.write_all(paths_header.as_bytes()).unwrap();
    drop(pos_w);
    assert!(
        pos_proc.wait().map(|s| s.success()).unwrap_or(false),
        "pos sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &pos_file]);

    // Flush segment temp files
    drop(segments_files);

    // Build segments.bin + .idx
    if sharded {
        let segs_dir = format!("{}_segments", output_prefix);
        fs::create_dir_all(&segs_dir).unwrap();
        let mut manifest_entries: Vec<(String, String)> = Vec::new();

        for genome in &genomes {
            let encoded = encode_filename(genome);
            let tmp_path = tmp_dir.join(format!("{}.tsv", encoded));
            let out_prefix = format!("{}/{}.segments", segs_dir, encoded);
            sort_and_build_segments(
                &tmp_path.to_string_lossy(),
                &full_header,
                &out_prefix,
                next_ordinal,
                &tmp_dir.to_string_lossy(),
            );
            let _ = fs::remove_file(&tmp_path);
            let dir_base = segs_dir.rsplit('/').next().unwrap_or(&segs_dir);
            manifest_entries.push((
                genome.clone(),
                format!("{}/{}.segments", dir_base, encoded),
            ));
        }

        write_manifest(
            &format!("{}.segments.manifest.json", output_prefix),
            &genomes,
            &manifest_entries,
        );
    } else {
        sort_and_build_segments(
            &combined_tmp.to_string_lossy(),
            &full_header,
            &format!("{}.segments", output_prefix),
            next_ordinal,
            &tmp_dir.to_string_lossy(),
        );
        let _ = fs::remove_file(&combined_tmp);
    }

    let rewritten_vcf_path;
    if let Some(ref vcf_path) = bubbles_vcf {
        generate_bubbles_from_vcf(vcf_path, &output_prefix, &genomes);
        rewritten_vcf_path = format!("{}.vcf.gz", output_prefix);
        // Write to a temp file first to avoid clobbering the input VCF
        // when the output path matches the input path
        let tmp_vcf = format!("{}.vcf.gz.tmp", output_prefix);
        rewrite_vcf_strip_pansn(vcf_path, &tmp_vcf);
        fs::rename(&tmp_vcf, &rewritten_vcf_path).expect("rename rewritten VCF");
        // tabix indexed the tmp path, rename the index too
        let tmp_tbi = format!("{}.tbi", tmp_vcf);
        let final_tbi = format!("{}.tbi", rewritten_vcf_path);
        if std::path::Path::new(&tmp_tbi).exists() {
            fs::rename(&tmp_tbi, &final_tbi).expect("rename rewritten VCF index");
        }
    } else {
        rewritten_vcf_path = String::new();
    }

    if let Some(ref config_path) = output_config {
        let vcf_for_config = if bubbles_vcf.is_some() {
            Some(rewritten_vcf_path.as_str())
        } else {
            None
        };
        write_jbrowse_config(
            config_path,
            &output_prefix,
            &genomes,
            vcf_for_config,
        );
    }

    let _ = fs::remove_dir_all(&tmp_dir);

    eprintln!("Done.");
    eprintln!("  Segments: {}", seg_lengths.len());
    eprintln!("  Paths: {}", path_count);
    eprintln!("  Genomes: {} ({})", genomes.len(), genomes.join(", "));
}

/// Sort the unsorted segments TSV by ordinal, then write a flat binary file
/// (.bin) with fixed-width 15-byte records and a companion byte-offset index
/// (.idx).
///
/// Binary record layout (little-endian):
///   segOrd:     u32  (4 bytes)
///   pathNameIdx: u16  (2 bytes)
///   offset:     u32  (4 bytes)
///   segLen:     u32  (4 bytes)
///   orient:     u8   (1 byte, ASCII '+' or '-')
///   Total:      15 bytes per record
///
/// The .idx file is a flat array of little-endian u64 values, one per numeric
/// ID.  idx[N] = byte offset in the binary file where node N's records begin.
///
/// No compression — the viewer reads exact byte ranges via the index, avoiding
/// all BGZF decompression overhead.
const RECORD_SIZE: u64 = 15;

fn sort_and_build_segments(
    unsorted_path: &str,
    _header: &str,
    output_prefix: &str,
    total_ordinals: u64,
    sort_tmp_dir: &str,
) {
    let bin_file = format!("{}.bin", output_prefix);
    let idx_file = format!("{}.idx", output_prefix);

    let mut sort_proc = Command::new("sh")
        .args([
            "-c",
            &format!(
                "sort -S 2G -T \"{}\" -t\"\t\" -k1,1n \"{}\"",
                sort_tmp_dir, unsorted_path
            ),
        ])
        .env("LC_ALL", "C")
        .stdout(Stdio::piped())
        .spawn()
        .expect("failed to spawn sort");

    let mut out = BufWriter::new(File::create(&bin_file).expect("create bin"));

    let mut index_offsets: Vec<u64> = Vec::new();
    let mut byte_offset: u64 = 0;
    let mut last_ord: i64 = -1;

    let sort_stdout = sort_proc.stdout.take().unwrap();
    for line in BufReader::new(sort_stdout).lines() {
        let line = line.expect("read sorted line");
        if line.is_empty() {
            continue;
        }

        // Parse TSV: segOrd \t pathNameIdx \t offset \t segLen \t orient
        let mut fields = line.splitn(5, '\t');
        let seg_ord: u64 = fields.next().unwrap().parse().unwrap_or(0);
        let path_name_idx: u16 = fields.next().unwrap().parse().unwrap_or(0);
        let offset: u32 = fields.next().unwrap().parse().unwrap_or(0);
        let seg_len: u32 = fields.next().unwrap().parse().unwrap_or(0);
        let orient: u8 = fields.next().unwrap().as_bytes()[0];

        if seg_ord as i64 != last_ord {
            while (index_offsets.len() as u64) <= seg_ord {
                index_offsets.push(byte_offset);
            }
            last_ord = seg_ord as i64;
        }

        out.write_all(&(seg_ord as u32).to_le_bytes()).unwrap();
        out.write_all(&path_name_idx.to_le_bytes()).unwrap();
        out.write_all(&offset.to_le_bytes()).unwrap();
        out.write_all(&seg_len.to_le_bytes()).unwrap();
        out.write_all(&[orient]).unwrap();

        byte_offset += RECORD_SIZE;
    }

    while (index_offsets.len() as u64) <= total_ordinals {
        index_offsets.push(byte_offset);
    }
    drop(out);

    assert!(
        sort_proc.wait().map(|s| s.success()).unwrap_or(false),
        "sort failed for {}",
        unsorted_path
    );

    // Write companion index
    let mut idx_out = BufWriter::new(File::create(&idx_file).expect("create idx"));
    for offset in &index_offsets {
        idx_out.write_all(&offset.to_le_bytes()).unwrap();
    }
}

/// Process one path (P-line or W-line walk) from the GFA, emitting:
///
///   - segments.tsv rows: one row per step with the segment's numeric ID (a
///     sequential integer we assign to each unique graph node), path name,
///     base-pair offset along the path, segment length, orientation, and
///     segment name.  These are later sorted by numeric ID and compressed into
///     segments.gz with a companion byte-offset index (.idx).
///
///   - pos.bed.gz rows: one row per chunk of `chunk_size` steps.  Each row is
///     a BED-like line (path, start_bp, end_bp) with a 4th column containing a
///     comma-separated list of the *exact* numeric IDs of graph nodes traversed
///     by that chunk.  The viewer uses this list to look up only the specific
///     nodes it needs from segments.gz, avoiding huge range reads.  (An earlier
///     format stored only min/max IDs per chunk, which caused multi-GB reads
///     when a path mixed shared and assembly-private nodes whose IDs were far
///     apart in the file.)
///
/// Numeric IDs are assigned on first encounter: the first path to traverse a
/// graph node determines its ID.  This means the GFA's path ordering matters —
/// assemblies listed earlier get tighter, more contiguous ID sequences.
/// A buffered step from parsing a walk, before writing to segments.tsv.
struct WalkStep {
    ord: u64,
    seg_len: u64,
    is_plus: bool,
}

fn emit_path_rows(
    path_name: &str,
    path_index: u64,
    seg_str: &str,
    is_walk: bool,
    chunk_size: usize,
    seg_lengths: &HashMap<String, u64>,
    seg_ordinals: &mut HashMap<String, u64>,
    next_ordinal: &mut u64,
    pos_w: &mut BufWriter<impl Write>,
    segments_w: &mut BufWriter<File>,
    ref_orients: &mut HashMap<u64, bool>,
    is_ref: bool,
    groom: bool,
) -> u64 {
    // Phase 1: parse the walk and assign ordinals, buffering all steps.
    let mut walk_steps: Vec<WalkStep> = Vec::new();

    let mut collect_step = |seg_id: &str, orient: &str| {
        let seg_len = seg_lengths.get(seg_id).copied().unwrap_or(0);
        let is_plus = orient == "+";

        let ord = if let Some(&o) = seg_ordinals.get(seg_id) {
            o
        } else {
            let o = *next_ordinal;
            *next_ordinal += 1;
            seg_ordinals.insert(seg_id.to_string(), o);
            o
        };

        if is_ref {
            ref_orients.insert(ord, is_plus);
        }

        walk_steps.push(WalkStep { ord, seg_len, is_plus });
    };

    if is_walk {
        let bytes = seg_str.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
                continue;
            }
            let orient = if bytes[pos] == b'>' { "+" } else { "-" };
            pos += 1;
            let start = pos;
            while pos < bytes.len() && bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
            }
            collect_step(&seg_str[start..pos], orient);
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], if step.ends_with('+') { "+" } else { "-" })
            } else {
                (step, "+")
            };
            collect_step(seg_id, orient);
        }
    }

    // Phase 2: for non-reference walks, detect if the walk is a
    // reverse-complemented contig. A walk is reverse-complemented iff
    // EVERY segment shared with the reference has opposite orient.
    // This is a deterministic condition, not a heuristic.
    let need_flip = if is_ref || !groom {
        false
    } else {
        // Use bp-weighted tally: tiny 1-2bp SNP nodes in the graph
        // shouldn't prevent detection of a reversed contig.
        let mut shared_bp = 0u64;
        let mut opposite_bp = 0u64;
        for step in &walk_steps {
            if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
                shared_bp += step.seg_len;
                if step.is_plus != ref_is_plus {
                    opposite_bp += step.seg_len;
                }
            }
        }
        // Flip if >99% of shared bp are opposite orientation.
        shared_bp > 0 && opposite_bp * 100 >= shared_bp * 99
    };

    // Phase 3: emit segments.tsv and pos.bed.gz rows.
    // If the walk needs flipping, reverse the offset direction and
    // invert all orient values.
    let total_len: u64 = walk_steps.iter().map(|s| s.seg_len).sum();
    let mut offset: u64 = 0;
    let mut chunk_start: u64 = 0;
    let mut chunk_ords: Vec<u64> = Vec::new();
    let mut steps: usize = 0;

    for step in &walk_steps {
        let effective_orient = if need_flip {
            if step.is_plus { "-" } else { "+" }
        } else if is_ref {
            if step.is_plus { "+" } else { "-" }
        } else if let Some(&ref_is_plus) = ref_orients.get(&step.ord) {
            if step.is_plus == ref_is_plus { "+" } else { "-" }
        } else {
            if step.is_plus { "+" } else { "-" }
        };

        let emit_offset = if need_flip {
            total_len - offset - step.seg_len
        } else {
            offset
        };

        writeln!(
            segments_w,
            "{}\t{}\t{}\t{}\t{}",
            step.ord, path_index, emit_offset, step.seg_len, effective_orient
        )
        .unwrap();

        chunk_ords.push(step.ord);
        offset += step.seg_len;
        steps += 1;

        if steps >= chunk_size {
            chunk_ords.sort_unstable();
            chunk_ords.dedup();
            let ords_str = encode_ordinal_ranges(&chunk_ords);
            if need_flip {
                let flip_start = total_len - offset;
                let flip_end = total_len - chunk_start;
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                    .unwrap();
            } else {
                writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                    .unwrap();
            }
            chunk_start = offset;
            chunk_ords.clear();
            steps = 0;
        }
    }

    if steps > 0 {
        chunk_ords.sort_unstable();
        chunk_ords.dedup();
        let ords_str = encode_ordinal_ranges(&chunk_ords);
        if need_flip {
            let flip_start = total_len - offset;
            let flip_end = total_len - chunk_start;
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, flip_start, flip_end, ords_str)
                .unwrap();
        } else {
            writeln!(pos_w, "{}\t{}\t{}\t{}", path_name, chunk_start, offset, ords_str)
                .unwrap();
        }
    }

    if need_flip {
        eprintln!("    flipped: {} (all {} shared segments had opposite orient)", path_name, walk_steps.iter().filter(|s| ref_orients.contains_key(&s.ord)).count());
    }

    total_len
}

fn parse_walk(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(8, '\t').collect();
    if parts.len() < 7 {
        return None;
    }
    let assembly = format!("{}#{}", parts[1], parts[2]);
    let path_name = format!("{}#{}#{}", parts[1], parts[2], parts[3]);
    Some((path_name, assembly, parts[6].to_string(), true))
}

fn parse_p_line(line: &str) -> Option<(String, String, String, bool)> {
    let parts: Vec<&str> = line.splitn(4, '\t').collect();
    if parts.len() < 3 {
        return None;
    }
    let raw_name = parts[1];
    let (sample, sequence) = match raw_name.rfind('#') {
        Some(idx) => (&raw_name[..idx], &raw_name[idx + 1..]),
        None => (raw_name, raw_name),
    };
    Some((
        format!("{}#{}", sample, sequence),
        sample.to_string(),
        parts[2].to_string(),
        false,
    ))
}

fn write_manifest(path: &str, genomes: &[String], files: &[(String, String)]) {
    let mut out = BufWriter::new(File::create(path).expect("create manifest"));
    write!(out, "{{\n  \"genomes\": [").unwrap();
    for (i, g) in genomes.iter().enumerate() {
        if i > 0 { write!(out, ",").unwrap(); }
        write!(out, "\n    \"{}\"", g).unwrap();
    }
    write!(out, "\n  ],\n  \"files\": {{").unwrap();
    for (i, (genome, prefix)) in files.iter().enumerate() {
        if i > 0 { write!(out, ",").unwrap(); }
        write!(out, "\n    \"{}\": \"{}\"", genome, prefix).unwrap();
    }
    write!(out, "\n  }}\n}}\n").unwrap();
}

fn encode_ordinal_ranges(ords: &[u64]) -> String {
    if ords.is_empty() {
        return String::new();
    }
    let mut parts: Vec<String> = Vec::new();
    let mut run_start = ords[0];
    let mut run_end = ords[0];
    for &o in &ords[1..] {
        if o == run_end + 1 {
            run_end = o;
        } else {
            if run_start == run_end {
                parts.push(run_start.to_string());
            } else {
                parts.push(format!("{}-{}", run_start, run_end));
            }
            run_start = o;
            run_end = o;
        }
    }
    if run_start == run_end {
        parts.push(run_start.to_string());
    } else {
        parts.push(format!("{}-{}", run_start, run_end));
    }
    parts.join(",")
}

fn encode_filename(s: &str) -> String {
    s.replace('#', "_").replace('/', "_")
}

fn output_parent(prefix: &str) -> std::path::PathBuf {
    std::path::Path::new(prefix)
        .parent()
        .unwrap_or(std::path::Path::new("."))
        .to_path_buf()
}

fn open_file(path: &str) -> Box<dyn BufRead> {
    if path == "-" {
        Box::new(BufReader::with_capacity(1 << 20, std::io::stdin()))
    } else if path.ends_with(".gz") {
        let child = Command::new("gzip")
            .args(["-dc", path])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, child.stdout.unwrap()))
    } else {
        let file = File::open(path).unwrap_or_else(|_| panic!("failed to open {}", path));
        Box::new(BufReader::with_capacity(1 << 20, file))
    }
}

fn spawn_sort_bgzip(output: &str) -> std::process::Child {
    Command::new("sh")
        .args(["-c", &format!("sort -t\"\t\" -k1,1 -k2,2n | bgzip > \"{}\"", output)])
        .env("LC_ALL", "C")
        .stdin(Stdio::piped())
        .spawn()
        .expect("failed to spawn sort|bgzip")
}

fn run_cmd(cmd: &str, args: &[&str]) {
    let status = Command::new(cmd).args(args).status().unwrap_or_else(|_| panic!("failed to run {}", cmd));
    if !status.success() {
        eprintln!("Warning: {} {:?} failed", cmd, args);
    }
}

// ── Binary CS encoding ──────────────────────────────────────────────────
//
// Format (high 2 bits of first byte = opcode):
//   Match  (00xxxxxx): low 6 bits = length for 1-63, else 0x00 + LEB128 varint
//   Sub    (01xxRRAA): single byte, bits 3:2 = ref base, bits 1:0 = alt base
//   Ins    (10xxxxxx): low 6 bits = length for 1-63, else 0x80 + LEB128 varint,
//                      followed by ceil(len/4) bytes of 2-bit packed bases
//   Del    (11xxxxxx): same as insertion
//
// Base encoding: A=0, C=1, G=2, T=3

const BCS_MATCH: u8 = 0x00;
const BCS_SUB: u8 = 0x40;
const BCS_INS: u8 = 0x80;
const BCS_DEL: u8 = 0xC0;

fn base_to_2bit(b: u8) -> u8 {
    match b {
        b'A' | b'a' => 0,
        b'C' | b'c' => 1,
        b'G' | b'g' => 2,
        b'T' | b't' => 3,
        _ => 0,
    }
}

fn write_varint(out: &mut Vec<u8>, mut value: u32) {
    while value >= 0x80 {
        out.push((value as u8 & 0x7f) | 0x80);
        value >>= 7;
    }
    out.push(value as u8);
}

fn pack_bases(seq: &[u8], out: &mut Vec<u8>) {
    for chunk in seq.chunks(4) {
        let mut byte: u8 = 0;
        for (j, &b) in chunk.iter().enumerate() {
            byte |= base_to_2bit(b) << (6 - j * 2);
        }
        out.push(byte);
    }
}

const TWOBIT_TO_BASE: [u8; 4] = [b'a', b'c', b'g', b't'];

fn unpack_bases(data: &[u8], len: usize) -> Vec<u8> {
    let mut out = Vec::with_capacity(len);
    for &byte in data {
        for shift in [6, 4, 2, 0] {
            if out.len() >= len { break; }
            out.push(TWOBIT_TO_BASE[((byte >> shift) & 0x03) as usize]);
        }
    }
    out
}

fn binary_cs_to_text(data: &[u8]) -> String {
    let mut out = String::new();
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let op = byte & 0xC0;

        if op == BCS_MATCH {
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                read_varint_slice(data, &mut i) as u64
            } else {
                len_bits as u64
            };
            out.push(':');
            out.push_str(&len.to_string());
        } else if op == BCS_SUB {
            let ref_base = TWOBIT_TO_BASE[((byte >> 2) & 0x03) as usize];
            let alt_base = TWOBIT_TO_BASE[(byte & 0x03) as usize];
            out.push('*');
            out.push(ref_base as char);
            out.push(alt_base as char);
            i += 1;
        } else {
            let is_ins = op == BCS_INS;
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                read_varint_slice(data, &mut i) as u64
            } else {
                len_bits as u64
            };
            let packed = ((len + 3) / 4) as usize;
            let bases = unpack_bases(&data[i..i + packed], len as usize);
            out.push(if is_ins { '+' } else { '-' });
            for &b in &bases {
                out.push(b as char);
            }
            i += packed;
        }
    }
    out
}

fn read_varint_slice(data: &[u8], pos: &mut usize) -> u32 {
    let mut value: u32 = 0;
    let mut shift = 0;
    while *pos < data.len() {
        let b = data[*pos];
        *pos += 1;
        value |= ((b & 0x7f) as u32) << shift;
        if b & 0x80 == 0 { break; }
        shift += 7;
    }
    value
}

fn to_lower(b: u8) -> u8 {
    if b >= b'A' && b <= b'Z' { b + 32 } else { b }
}

// Compare two byte sequences and produce binary CS directly,
// avoiding intermediate text CS string entirely.
fn compute_binary_cs_from_bytes(ref_seq: &[u8], query_seq: &[u8]) -> Vec<u8> {
    let min_len = ref_seq.len().min(query_seq.len());
    let mut out: Vec<u8> = Vec::new();

    let mut match_run = 0u32;
    for i in 0..min_len {
        if ref_seq[i] == query_seq[i] {
            match_run += 1;
        } else {
            if match_run > 0 {
                if match_run <= 63 {
                    out.push(BCS_MATCH | match_run as u8);
                } else {
                    out.push(BCS_MATCH);
                    write_varint(&mut out, match_run);
                }
                match_run = 0;
            }
            let ref_base = base_to_2bit(ref_seq[i]);
            let alt_base = base_to_2bit(query_seq[i]);
            out.push(BCS_SUB | (ref_base << 2) | alt_base);
        }
    }
    if match_run > 0 {
        if match_run <= 63 {
            out.push(BCS_MATCH | match_run as u8);
        } else {
            out.push(BCS_MATCH);
            write_varint(&mut out, match_run);
        }
    }

    if ref_seq.len() > min_len {
        encode_indel(&mut out, BCS_DEL, &ref_seq[min_len..]);
    } else if query_seq.len() > min_len {
        encode_indel(&mut out, BCS_INS, &query_seq[min_len..]);
    }

    out
}

fn compute_identity_from_binary_cs(data: &[u8]) -> f64 {
    let mut match_bp: u64 = 0;
    let mut mismatch_bp: u64 = 0;
    let mut i = 0;
    while i < data.len() {
        let byte = data[i];
        let op = byte & 0xC0;
        if op == BCS_MATCH {
            let len_bits = byte & 0x3F;
            i += 1;
            if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                match_bp += value as u64;
            } else {
                match_bp += len_bits as u64;
            }
        } else if op == BCS_SUB {
            mismatch_bp += 1;
            i += 1;
        } else {
            // INS or DEL
            let len_bits = byte & 0x3F;
            i += 1;
            let len = if len_bits == 0 {
                let mut value: u32 = 0;
                let mut shift = 0;
                while i < data.len() {
                    let b = data[i];
                    value |= ((b & 0x7f) as u32) << shift;
                    i += 1;
                    if b & 0x80 == 0 { break; }
                    shift += 7;
                }
                value
            } else {
                len_bits as u32
            };
            i += ((len + 3) / 4) as usize;
        }
    }
    let total = match_bp + mismatch_bp;
    if total > 0 { match_bp as f64 / total as f64 } else { 1.0 }
}

fn encode_indel(cs: &mut Vec<u8>, op: u8, seq: &[u8]) {
    let len = seq.len() as u32;
    if len <= 63 { cs.push(op | len as u8); }
    else { cs.push(op); write_varint(cs, len); }
    pack_bases(seq, cs);
}

fn encode_bubble_cs(ref_seq: &[u8], query_seq: &[u8], cs: &mut Vec<u8>) {
    if !ref_seq.is_empty() && !query_seq.is_empty() {
        cs.extend_from_slice(&compute_binary_cs_from_bytes(ref_seq, query_seq));
    } else if !ref_seq.is_empty() {
        encode_indel(cs, BCS_DEL, ref_seq);
    } else if !query_seq.is_empty() {
        encode_indel(cs, BCS_INS, query_seq);
    }
}

fn write_jbrowse_config(
    config_path: &str,
    output_prefix: &str,
    genomes: &[String],
    bubbles_vcf: Option<&str>,
) {
    eprintln!("Writing JBrowse config...");
    let mut out = BufWriter::new(File::create(config_path).expect("create config file"));

    let pos_bed = format!("{}.pos.bed.gz", output_prefix);
    let pos_tbi = format!("{}.pos.bed.gz.tbi", output_prefix);
    let seg_bin = format!("{}.segments.bin", output_prefix);
    let seg_idx = format!("{}.segments.idx", output_prefix);
    let bubbles_bed = format!("{}.bubbles.bed.gz", output_prefix);
    let bubbles_tbi = format!("{}.bubbles.bed.gz.tbi", output_prefix);

    // Build assembly names JSON array
    let assembly_names_json: Vec<String> = genomes.iter().map(|g| format!("\"{}\"", g)).collect();

    write!(out, "{{\n  \"tracks\": [\n").unwrap();

    // GfaTabix multi-synteny track
    write!(out, "    {{\n").unwrap();
    write!(out, "      \"type\": \"MultiSyntenyTrack\",\n").unwrap();
    write!(out, "      \"trackId\": \"gfa_tabix_multi\",\n").unwrap();
    write!(out, "      \"name\": \"Pangenome synteny\",\n").unwrap();
    write!(out, "      \"category\": [\"Synteny\"],\n").unwrap();
    write!(out, "      \"adapter\": {{\n").unwrap();
    write!(out, "        \"type\": \"GfaTabixAdapter\",\n").unwrap();
    write!(out, "        \"posLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", pos_bed).unwrap();
    write!(out, "        \"posIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }},\n", pos_tbi).unwrap();
    write!(out, "        \"segmentsLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", seg_bin).unwrap();
    if bubbles_vcf.is_some() {
        write!(out, "        \"segmentsIdxLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", seg_idx).unwrap();
        write!(out, "        \"bubblesLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", bubbles_bed).unwrap();
        write!(out, "        \"bubblesIndex\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}\n", bubbles_tbi).unwrap();
    } else {
        write!(out, "        \"segmentsIdxLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }}\n", seg_idx).unwrap();
    }

    write!(out, "      }},\n").unwrap();
    write!(out, "      \"assemblyNames\": [{}]\n", assembly_names_json.join(", ")).unwrap();
    write!(out, "    }}").unwrap();

    // VCF variant track (when --bubbles VCF was provided)
    if let Some(vcf_path) = bubbles_vcf {
        let vcf_tbi = format!("{}.tbi", vcf_path);
        write!(out, ",\n    {{\n").unwrap();
        write!(out, "      \"type\": \"VariantTrack\",\n").unwrap();
        write!(out, "      \"trackId\": \"pangenome_vcf\",\n").unwrap();
        write!(out, "      \"name\": \"Pangenome variants (vg deconstruct)\",\n").unwrap();
        write!(out, "      \"category\": [\"Variants\"],\n").unwrap();
        write!(out, "      \"adapter\": {{\n").unwrap();
        write!(out, "        \"type\": \"VcfTabixAdapter\",\n").unwrap();
        write!(out, "        \"vcfGzLocation\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }},\n", vcf_path).unwrap();
        write!(out, "        \"index\": {{ \"location\": {{ \"uri\": \"{}\", \"locationType\": \"UriLocation\" }} }}\n", vcf_tbi).unwrap();
        write!(out, "      }},\n").unwrap();
        // VCF variant track only needs the reference assembly (first genome)
        if let Some(ref_genome) = genomes.first() {
            write!(out, "      \"assemblyNames\": [\"{}\"]\n", ref_genome).unwrap();
        }
        write!(out, "    }}").unwrap();
    }

    write!(out, "\n  ]\n}}\n").unwrap();
    eprintln!("  Wrote {}", config_path);
}

/// Strips PanSN contig names from a `vg deconstruct` VCF.
/// `GRCh38#0#chr20` in CHROM column and `##contig` headers becomes `chr20`
/// (last `#`-separated component).  The output is bgzipped and tabix-indexed.
fn rewrite_vcf_strip_pansn(vcf_path: &str, output_path: &str) {
    eprintln!("Rewriting VCF with stripped PanSN contig names...");
    let reader = open_file(vcf_path);

    let mut bgzip = Command::new("bgzip")
        .stdin(Stdio::piped())
        .stdout(File::create(output_path).expect("create rewritten VCF"))
        .spawn()
        .expect("failed to spawn bgzip");
    let mut w = BufWriter::new(bgzip.stdin.take().unwrap());

    for line in reader.lines() {
        let line = line.expect("read error");
        if line.starts_with("##contig=<ID=") {
            // ##contig=<ID=GRCh38#0#chr20,length=64444167>
            // → ##contig=<ID=chr20,length=64444167>
            let rest = &line["##contig=<ID=".len()..];
            if let Some(comma_pos) = rest.find(',') {
                let contig_name = &rest[..comma_pos];
                let stripped = strip_pansn_contig(contig_name);
                writeln!(w, "##contig=<ID={}{}", stripped, &rest[comma_pos..]).unwrap();
            } else {
                let contig_name = rest.trim_end_matches('>');
                let stripped = strip_pansn_contig(contig_name);
                writeln!(w, "##contig=<ID={}>", stripped).unwrap();
            }
            continue;
        }
        if line.starts_with("##") {
            writeln!(w, "{}", line).unwrap();
            continue;
        }
        if line.starts_with("#CHROM") {
            writeln!(w, "{}", line).unwrap();
            continue;
        }

        // Data line: strip PanSN from CHROM (field 0)
        if let Some(tab_pos) = line.find('\t') {
            let chrom = &line[..tab_pos];
            let stripped = strip_pansn_contig(chrom);
            write!(w, "{}{}\n", stripped, &line[tab_pos..]).unwrap();
        } else {
            writeln!(w, "{}", line).unwrap();
        }
    }

    drop(w);
    assert!(
        bgzip.wait().map(|s| s.success()).unwrap_or(false),
        "bgzip failed for rewritten VCF"
    );
    run_cmd("tabix", &["-p", "vcf", output_path]);
    eprintln!("  Wrote {}", output_path);
}

/// Strips PanSN prefix from a contig name: `GRCh38#0#chr20` → `chr20`.
/// Returns the last `#`-separated component if there are 3+ parts,
/// otherwise returns the name unchanged.
fn strip_pansn_contig(name: &str) -> &str {
    let parts: Vec<&str> = name.split('#').collect();
    if parts.len() >= 3 {
        parts[parts.len() - 1]
    } else {
        name
    }
}

fn generate_bubbles_from_vcf(vcf_path: &str, output_prefix: &str, genomes: &[String]) {
    eprintln!("Generating bubbles from VCF...");
    let t_start = Instant::now();
    let bubbles_file = format!("{}.bubbles.bed.gz", output_prefix);

    let mut proc = spawn_sort_bgzip(&bubbles_file);
    let mut w = BufWriter::new(proc.stdin.take().unwrap());

    let reader = open_file(vcf_path);
    let mut sample_names: Vec<String> = Vec::new();
    // Maps (VCF sample index, haplotype index) → GFA genome index.
    // For phased GT "0|1": haplotype 0 = first allele, haplotype 1 = second.
    // Built once when the #CHROM header is parsed.
    let mut sample_hap_to_genome: Vec<Vec<usize>> = Vec::new();
    // Total number of GFA-matching genome entries in the bubbles header
    let mut bubble_genome_names: Vec<String> = Vec::new();
    let mut record_count: u64 = 0;

    for line in reader.lines() {
        let line = line.expect("read error");
        if line.starts_with("##") {
            continue;
        }
        if line.starts_with("#CHROM") {
            let fields: Vec<&str> = line.split('\t').collect();
            if fields.len() > 9 {
                for f in &fields[9..] {
                    sample_names.push(f.to_string());
                }
            }

            // Map VCF samples to GFA genome names. A VCF sample "HG00438"
            // may correspond to GFA genomes "HG00438#1" and "HG00438#2".
            // We assign a bubble genome index to each GFA genome and record
            // which (sample, haplotype) maps to which bubble genome index.
            let genome_set: HashMap<&str, Vec<(usize, &str)>> = {
                let mut m: HashMap<&str, Vec<(usize, &str)>> = HashMap::new();
                for (gi, g) in genomes.iter().enumerate() {
                    // GFA genome name is "sample#haplotype", extract sample part
                    let sample_part = g.split('#').next().unwrap_or(g);
                    m.entry(sample_part).or_default().push((gi, g));
                }
                m
            };

            for sample_name in &sample_names {
                let mut hap_indices: Vec<usize> = Vec::new();
                if let Some(gfa_genomes) = genome_set.get(sample_name.as_str()) {
                    // Sort by haplotype number so index 0 = hap 1, index 1 = hap 2
                    let mut sorted: Vec<_> = gfa_genomes.clone();
                    sorted.sort_by_key(|(_, name)| {
                        name.split('#').nth(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0)
                    });
                    for (_, gfa_name) in &sorted {
                        let idx = bubble_genome_names.len();
                        bubble_genome_names.push(gfa_name.to_string());
                        hap_indices.push(idx);
                    }
                }
                sample_hap_to_genome.push(hap_indices);
            }

            eprintln!("  {} VCF samples → {} bubble genomes", sample_names.len(), bubble_genome_names.len());
            writeln!(w, "#genomes={}", bubble_genome_names.join(",")).unwrap();
            continue;
        }

        let fields: Vec<&str> = line.split('\t').collect();
        if fields.len() < 10 {
            continue;
        }

        let chrom = fields[0];
        let pos: u64 = fields[1].parse().unwrap_or(0);
        let ref_seq = fields[3];
        let alt_field = fields[4];
        let start = pos - 1;
        let end = start + ref_seq.len() as u64;

        let mut alleles: Vec<&str> = Vec::new();
        alleles.push(ref_seq);
        for alt in alt_field.split(',') {
            alleles.push(alt);
        }

        // Parse GT fields to build genome lists per allele.
        // For phased GTs ("|"), each haplotype maps to a separate bubble genome.
        // For unphased GTs ("/"), all haplotypes get the same allele assignments.
        let num_alleles = alleles.len();
        let mut allele_genomes: Vec<Vec<usize>> = vec![Vec::new(); num_alleles];

        for (si, &sample_field) in fields[9..].iter().enumerate() {
            let gt = sample_field.split(':').next().unwrap_or(".");
            let is_phased = gt.contains('|');
            let parts: Vec<&str> = gt.split(|c: char| c == '|' || c == '/').collect();
            let haps = &sample_hap_to_genome[si];

            for (hi, part) in parts.iter().enumerate() {
                if *part != "." {
                    if let Ok(allele_idx) = part.parse::<usize>() {
                        if allele_idx < num_alleles {
                            if is_phased && hi < haps.len() {
                                // Phased: haplotype hi → specific genome
                                allele_genomes[allele_idx].push(haps[hi]);
                            } else {
                                // Unphased or no GFA mapping: assign all haplotypes
                                for &gidx in haps {
                                    allele_genomes[allele_idx].push(gidx);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Compute CS between all distinct allele pairs.
        // Limit allele length and pair count to avoid O(n²) blowup on
        // highly multi-allelic SVs.
        const MAX_ALLELE_LEN: usize = 10_000;
        const MAX_PAIRS_PER_SITE: usize = 500;
        let mut site_pairs: usize = 0;
        for a in 0..num_alleles {
            if site_pairs >= MAX_PAIRS_PER_SITE {
                break;
            }
            for b in (a + 1)..num_alleles {
                if site_pairs >= MAX_PAIRS_PER_SITE {
                    break;
                }
                let seq_a = alleles[a].as_bytes();
                let seq_b = alleles[b].as_bytes();

                let (cs_text, identity) = if seq_a.len() > MAX_ALLELE_LEN && seq_b.len() > MAX_ALLELE_LEN {
                    (String::new(), 0.0)
                } else {
                    let lowered_a: Vec<u8> = seq_a.iter().map(|&c| to_lower(c)).collect();
                    let lowered_b: Vec<u8> = seq_b.iter().map(|&c| to_lower(c)).collect();

                    let mut cs_bin: Vec<u8> = Vec::new();
                    encode_bubble_cs(&lowered_a, &lowered_b, &mut cs_bin);

                    (binary_cs_to_text(&cs_bin), compute_identity_from_binary_cs(&cs_bin))
                };

                let genomes_a: Vec<String> = allele_genomes[a].iter().map(|&i| i.to_string()).collect();
                let genomes_b: Vec<String> = allele_genomes[b].iter().map(|&i| i.to_string()).collect();

                writeln!(w, "{}\t{}\t{}\t{}\t{}\t{:.6}\t{}\t{}\t{}",
                    chrom, start, end, a, b, identity, cs_text,
                    genomes_a.join(","), genomes_b.join(","),
                ).unwrap();
                record_count += 1;
                site_pairs += 1;
            }
        }
    }

    drop(w);
    assert!(
        proc.wait().map(|s| s.success()).unwrap_or(false),
        "bubbles sort|bgzip failed"
    );
    run_cmd("tabix", &["-c", "#", "-p", "bed", &bubbles_file]);

    eprintln!("  {} records ({:.1}s)", record_count, t_start.elapsed().as_secs_f64());
    eprintln!("  Wrote {}", bubbles_file);
}

