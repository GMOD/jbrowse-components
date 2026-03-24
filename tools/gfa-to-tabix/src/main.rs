use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, BufWriter, Write};
use std::process::{Command, Stdio};

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
    /// Input file (GFA for normal mode, aln.bed.gz for --bed-to-bin mode)
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

    /// Convert a text aln.bed.gz to binary aln.bin + aln.idx instead of
    /// processing a GFA file
    #[arg(long)]
    bed_to_bin: bool,

    /// Generate binary alignment file (aln.bin + aln.idx) from the GFA.
    /// Requires that the GFA contains actual segment sequences (not '*').
    #[arg(long)]
    aln_bin: bool,
}

fn main() {
    let cli = Args::parse();

    if cli.bed_to_bin {
        bed_to_bin(&cli.input_file, cli.output_prefix.as_deref());
        return;
    }

    let gfa_path = &cli.input_file;

    let output_prefix = cli.output_prefix.clone().unwrap_or_else(|| {
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
    let generate_aln_bin = cli.aln_bin;

    // Pass 1: collect segment lengths from S-lines.  Numeric IDs are NOT
    // assigned here — they are assigned during path traversal in Pass 2 so
    // that graph nodes visited consecutively by the first assembly get
    // consecutive IDs.  This keeps the ID lists in pos.bed.gz compact for that
    // assembly's queries, reducing the number of byte-range reads against
    // segments.gz.
    eprintln!("Pass 1: Reading segments...");
    let mut seg_lengths: HashMap<String, u64> = HashMap::new();
    let mut seg_sequences: HashMap<String, String> = HashMap::new();
    let mut seg_ordinals: HashMap<String, u64> = HashMap::new();
    let mut next_ordinal: u64 = 0;
    let mut has_sequences = false;

    for line in open_file(gfa_path).lines() {
        let line = line.expect("read error");
        if !line.starts_with("S\t") {
            continue;
        }
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
        if generate_aln_bin && seq != "*" {
            has_sequences = true;
            seg_sequences.insert(name.clone(), seq.to_string());
        }
        seg_lengths.insert(name, length);
    }
    eprintln!("  {} segments", seg_lengths.len());
    if generate_aln_bin && !has_sequences {
        eprintln!("Warning: --aln-bin requested but GFA has no segment sequences (all '*'). Skipping aln generation.");
    }

    // Pass 2: walk each path, assigning numeric IDs to graph nodes on first
    // encounter, and emitting both pos.bed.gz chunks (with explicit ID lists)
    // and segments.tsv rows (one per path×node, later sorted by numeric ID).
    eprintln!("Pass 2: Processing paths...");

    let tmp_dir = output_parent(&output_prefix).join(format!(".gfa-tmp-{}", std::process::id()));
    fs::create_dir_all(&tmp_dir).expect("failed to create temp dir");

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
    // For aln generation: store (path_name, assembly, segment_walk_string, is_walk)
    // per path so we can do pairwise comparison after ordinals are assigned.
    let mut path_walks: Vec<(String, String, String, bool)> = Vec::new();
    // Map from segment ordinal → reference orient (true = "+").
    // Populated by the first assembly's paths (the reference).
    let mut ref_orients: HashMap<u64, bool> = HashMap::new();
    let mut ref_assembly: Option<String> = None;
    let mut path_names: Vec<String> = Vec::new();
    let mut path_name_indices: HashMap<String, u64> = HashMap::new();
    let mut path_sizes: Vec<(String, u64)> = Vec::new();
    let mut path_count: u64 = 0;

    for line in open_file(gfa_path).lines() {
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

            // Use --ref-assembly if provided, otherwise the first assembly.
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

            if generate_aln_bin && has_sequences {
                path_walks.push((path_name.clone(), assembly.clone(), seg_str.clone(), is_walk));
            }

            path_sizes.push((path_name, total));
            path_count += 1;
        }
    }

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

    let _ = fs::remove_dir_all(&tmp_dir);

    // Generate binary alignment file if requested
    if generate_aln_bin && has_sequences {
        eprintln!("Generating binary alignment file...");
        generate_aln_bin_from_paths(
            &output_prefix,
            &path_walks,
            &seg_ordinals,
            &seg_sequences,
            &seg_lengths,
            &ref_orients,
            ref_assembly.as_deref(),
            groom,
        );
    }

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
    if path.ends_with(".gz") {
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

fn is_cs_op(b: u8) -> bool {
    b == b':' || b == b'*' || b == b'+' || b == b'-'
}

fn encode_cs_binary(cs: &str) -> Vec<u8> {
    let bytes = cs.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b':' => {
                i += 1;
                let mut num: u32 = 0;
                while i < bytes.len() && bytes[i] >= b'0' && bytes[i] <= b'9' {
                    num = num * 10 + (bytes[i] - b'0') as u32;
                    i += 1;
                }
                if num > 0 && num <= 63 {
                    out.push(BCS_MATCH | num as u8);
                } else if num > 0 {
                    out.push(BCS_MATCH);
                    write_varint(&mut out, num);
                }
            }
            b'*' => {
                let ref_base = base_to_2bit(bytes[i + 1]);
                let alt_base = base_to_2bit(bytes[i + 2]);
                out.push(BCS_SUB | (ref_base << 2) | alt_base);
                i += 3;
            }
            b'+' | b'-' => {
                let op = if bytes[i] == b'+' { BCS_INS } else { BCS_DEL };
                i += 1;
                let start = i;
                while i < bytes.len() && !is_cs_op(bytes[i]) {
                    i += 1;
                }
                let len = (i - start) as u32;
                if len > 0 {
                    if len <= 63 {
                        out.push(op | len as u8);
                    } else {
                        out.push(op);
                        write_varint(&mut out, len);
                    }
                    pack_bases(&bytes[start..start + len as usize], &mut out);
                }
            }
            _ => {
                i += 1;
            }
        }
    }
    out
}

fn compute_identity_from_cs(cs: &str) -> f64 {
    let bytes = cs.as_bytes();
    let mut match_bp: u64 = 0;
    let mut mismatch_bp: u64 = 0;
    let mut i = 0;

    while i < bytes.len() {
        match bytes[i] {
            b':' => {
                i += 1;
                let mut num: u64 = 0;
                while i < bytes.len() && bytes[i] >= b'0' && bytes[i] <= b'9' {
                    num = num * 10 + (bytes[i] - b'0') as u64;
                    i += 1;
                }
                match_bp += num;
            }
            b'*' => {
                mismatch_bp += 1;
                i += 3;
            }
            b'+' | b'-' => {
                i += 1;
                while i < bytes.len() && !is_cs_op(bytes[i]) {
                    i += 1;
                }
            }
            _ => {
                i += 1;
            }
        }
    }

    let total = match_bp + mismatch_bp;
    if total > 0 { match_bp as f64 / total as f64 } else { 1.0 }
}

// ── aln.bin / aln.idx format ─────────────────────────────────────────────
//
// aln.bin: sorted binary records (by chrom, refStart)
//   Per record:
//     refStart:       u32 (4)
//     refEnd:         u32 (4)
//     queryGenomeIdx: u16 (2)
//     mateChromIdx:   u16 (2)
//     mateStart:      u32 (4)
//     mateEnd:        u32 (4)
//     strand:         u8  (1, 0x2B='+' or 0x2D='-')
//     identity:       u16 (2, identity * 10000)
//     csLen:          u16 (2)
//     csData:         [u8; csLen]
//
// aln.idx: index header + per-chrom linear index
//   Header:
//     magic:      4 bytes "ALNI"
//     version:    u8
//     numGenomes: u16
//     genome names: [u16 len, UTF-8 bytes] × numGenomes
//     numChroms:  u16
//     chrom names: [u16 len, UTF-8 bytes] × numChroms
//   Per chrom:
//     chromIdx:   u16
//     chromLen:   u32 (bp)
//     numBins:    u32 (ceil(chromLen / BIN_SIZE))
//     binOffsets: [u64] × (numBins + 1)

const BIN_SIZE: u32 = 16384;
const ALN_RECORD_FIXED: usize = 25;

struct AlnRecord {
    ref_start: u32,
    ref_end: u32,
    query_genome_idx: u16,
    mate_chrom_idx: u16,
    mate_start: u32,
    mate_end: u32,
    strand: u8,
    identity: u16,
    cs_data: Vec<u8>,
}

impl AlnRecord {
    fn write_to(&self, w: &mut impl Write) {
        w.write_all(&self.ref_start.to_le_bytes()).unwrap();
        w.write_all(&self.ref_end.to_le_bytes()).unwrap();
        w.write_all(&self.query_genome_idx.to_le_bytes()).unwrap();
        w.write_all(&self.mate_chrom_idx.to_le_bytes()).unwrap();
        w.write_all(&self.mate_start.to_le_bytes()).unwrap();
        w.write_all(&self.mate_end.to_le_bytes()).unwrap();
        w.write_all(&[self.strand]).unwrap();
        w.write_all(&self.identity.to_le_bytes()).unwrap();
        w.write_all(&(self.cs_data.len() as u16).to_le_bytes()).unwrap();
        w.write_all(&self.cs_data).unwrap();
    }

    fn byte_len(&self) -> usize {
        ALN_RECORD_FIXED + self.cs_data.len()
    }
}

fn write_length_prefixed_string(w: &mut impl Write, s: &str) {
    let bytes = s.as_bytes();
    w.write_all(&(bytes.len() as u16).to_le_bytes()).unwrap();
    w.write_all(bytes).unwrap();
}

// ── Generate aln.bin directly from GFA path walks ────────────────────────

#[derive(Clone)]
struct PathSegStep {
    seg_name: String,
    orient: bool, // true = '+'
}

fn parse_walk_steps(seg_str: &str, is_walk: bool) -> Vec<PathSegStep> {
    let mut steps = Vec::new();
    if is_walk {
        let bytes = seg_str.as_bytes();
        let mut pos = 0;
        while pos < bytes.len() {
            if bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
                continue;
            }
            let orient = bytes[pos] == b'>';
            pos += 1;
            let start = pos;
            while pos < bytes.len() && bytes[pos] != b'>' && bytes[pos] != b'<' {
                pos += 1;
            }
            steps.push(PathSegStep {
                seg_name: seg_str[start..pos].to_string(),
                orient,
            });
        }
    } else {
        for step in seg_str.split(',') {
            let (seg_id, orient) = if step.ends_with('+') || step.ends_with('-') {
                (&step[..step.len() - 1], step.ends_with('+'))
            } else {
                (step, true)
            };
            steps.push(PathSegStep {
                seg_name: seg_id.to_string(),
                orient,
            });
        }
    }
    steps
}

fn reverse_complement(seq: &str) -> String {
    seq.chars()
        .rev()
        .map(|c| match c {
            'A' | 'a' => 't',
            'C' | 'c' => 'g',
            'G' | 'g' => 'c',
            'T' | 't' => 'a',
            'N' | 'n' => 'n',
            other => other,
        })
        .collect()
}

fn get_seg_sequence(
    seg_name: &str,
    orient: bool,
    seg_sequences: &HashMap<String, String>,
) -> String {
    let seq = seg_sequences.get(seg_name).cloned().unwrap_or_default();
    if orient {
        seq.to_lowercase()
    } else {
        reverse_complement(&seq)
    }
}

fn compute_cs_from_sequences(ref_seq: &str, query_seq: &str) -> String {
    let ref_bytes = ref_seq.as_bytes();
    let query_bytes = query_seq.as_bytes();
    let mut cs = String::new();
    let min_len = ref_bytes.len().min(query_bytes.len());

    let mut match_run = 0u64;
    for i in 0..min_len {
        if ref_bytes[i] == query_bytes[i] {
            match_run += 1;
        } else {
            if match_run > 0 {
                cs.push_str(&format!(":{}", match_run));
                match_run = 0;
            }
            cs.push('*');
            cs.push(ref_bytes[i] as char);
            cs.push(query_bytes[i] as char);
        }
    }
    if match_run > 0 {
        cs.push_str(&format!(":{}", match_run));
    }

    // Handle length differences as indels
    if ref_bytes.len() > min_len {
        cs.push('-');
        cs.push_str(&String::from_utf8_lossy(&ref_bytes[min_len..]));
    } else if query_bytes.len() > min_len {
        cs.push('+');
        cs.push_str(&String::from_utf8_lossy(&query_bytes[min_len..]));
    }

    cs
}

fn generate_aln_bin_from_paths(
    output_prefix: &str,
    path_walks: &[(String, String, String, bool)],
    seg_ordinals: &HashMap<String, u64>,
    seg_sequences: &HashMap<String, String>,
    seg_lengths: &HashMap<String, u64>,
    ref_orients: &HashMap<u64, bool>,
    ref_assembly: Option<&str>,
    groom: bool,
) {
    // Group paths by assembly
    let mut assembly_paths: HashMap<String, Vec<(String, Vec<PathSegStep>)>> = HashMap::new();
    for (path_name, assembly, seg_str, is_walk) in path_walks {
        let steps = parse_walk_steps(seg_str, *is_walk);
        assembly_paths
            .entry(assembly.clone())
            .or_default()
            .push((path_name.clone(), steps));
    }

    let ref_asm = ref_assembly.unwrap_or_else(|| {
        path_walks.first().map(|(_, a, _, _)| a.as_str()).unwrap_or("")
    });

    let ref_paths: Vec<(String, Vec<PathSegStep>)> = match assembly_paths.get(ref_asm) {
        Some(p) => p.clone(),
        None => {
            eprintln!("  No paths found for reference assembly '{}'", ref_asm);
            return;
        }
    };

    // Collect genome and chrom names
    let mut genome_names: Vec<String> = Vec::new();
    let mut genome_map: HashMap<String, u16> = HashMap::new();
    let mut chrom_names: Vec<String> = Vec::new();
    let mut chrom_map: HashMap<String, u16> = HashMap::new();

    // Register chrom/genome names
    for (path_name, assembly, _, _) in path_walks {
        if !genome_map.contains_key(assembly) {
            let idx = genome_names.len() as u16;
            genome_map.insert(assembly.clone(), idx);
            genome_names.push(assembly.clone());
        }
        if !chrom_map.contains_key(path_name) {
            let idx = chrom_names.len() as u16;
            chrom_map.insert(path_name.clone(), idx);
            chrom_names.push(path_name.clone());
        }
    }

    let mut all_records: Vec<(u16, AlnRecord)> = Vec::new();

    // For each ref path, compare against all non-ref paths that share segments
    for (ref_path_name, ref_steps) in ref_paths.iter() {
        // Build ref ordinal → (index, offset) map
        let ref_chrom_idx = chrom_map[ref_path_name];
        let mut ref_offset: u64 = 0;
        let mut ref_by_ord: HashMap<u64, (usize, u64)> = HashMap::new();
        for (i, step) in ref_steps.iter().enumerate() {
            if let Some(&ord) = seg_ordinals.get(&step.seg_name) {
                ref_by_ord.insert(ord, (i, ref_offset));
            }
            ref_offset += seg_lengths.get(&step.seg_name).copied().unwrap_or(0);
        }

        // Compare with each non-ref assembly's paths
        for (query_asm, query_paths) in &assembly_paths {
            if query_asm == ref_asm {
                continue;
            }
            let query_genome_idx = genome_map[query_asm];

            for (query_path_name, query_steps) in query_paths {
                let query_chrom_idx = chrom_map[query_path_name];

                // Detect if query needs grooming (reverse complement)
                let need_flip = if !groom {
                    false
                } else {
                    let mut shared_bp = 0u64;
                    let mut opposite_bp = 0u64;
                    for step in query_steps {
                        if let Some(&ord) = seg_ordinals.get(&step.seg_name) {
                            if let Some(&ref_is_plus) = ref_orients.get(&ord) {
                                let seg_len = seg_lengths.get(&step.seg_name).copied().unwrap_or(0);
                                shared_bp += seg_len;
                                if step.orient != ref_is_plus {
                                    opposite_bp += seg_len;
                                }
                            }
                        }
                    }
                    shared_bp > 0 && opposite_bp * 100 >= shared_bp * 99
                };

                // Find shared segments (anchors) sorted by ref position
                struct AnchorMatch {
                    ref_idx: usize,
                    query_idx: usize,
                    ref_offset: u64,
                    seg_len: u64,
                    same_strand: bool,
                }

                let query_total_len: u64 = query_steps.iter()
                    .map(|s| seg_lengths.get(&s.seg_name).copied().unwrap_or(0))
                    .sum();

                let mut anchors: Vec<AnchorMatch> = Vec::new();
                for (qi, step) in query_steps.iter().enumerate() {
                    if let Some(&ord) = seg_ordinals.get(&step.seg_name) {
                        if let Some(&(ri, r_off)) = ref_by_ord.get(&ord) {
                            let seg_len = seg_lengths.get(&step.seg_name).copied().unwrap_or(0);
                            let ref_orient = ref_steps[ri].orient;
                            let effective_orient = if need_flip { !step.orient } else { step.orient };
                            anchors.push(AnchorMatch {
                                ref_idx: ri,
                                query_idx: qi,
                                ref_offset: r_off,
                                seg_len,
                                same_strand: effective_orient == ref_orient,
                            });
                        }
                    }
                }

                // Sort anchors by ref position
                anchors.sort_by_key(|a| a.ref_offset);

                // Merge consecutive same-strand anchors into alignment blocks
                let mut block_start_ref: i64 = -1;
                let mut block_end_ref: u64 = 0;
                let mut block_start_query: u64 = 0;
                let mut block_end_query: u64 = 0;
                let mut block_strand: i8 = 0;
                let mut block_cs = String::new();
                let mut block_prev_ref_idx: i64 = -1;
                let mut block_prev_query_idx: i64 = -1;

                let flush_block = |records: &mut Vec<(u16, AlnRecord)>,
                                   ref_chrom_idx: u16,
                                   query_genome_idx: u16,
                                   query_chrom_idx: u16,
                                   start_ref: u64,
                                   end_ref: u64,
                                   start_query: u64,
                                   end_query: u64,
                                   strand: i8,
                                   cs: &str| {
                    if cs.is_empty() {
                        return;
                    }
                    let identity = compute_identity_from_cs(cs);
                    let cs_data = encode_cs_binary(cs);
                    records.push((ref_chrom_idx, AlnRecord {
                        ref_start: start_ref as u32,
                        ref_end: end_ref as u32,
                        query_genome_idx,
                        mate_chrom_idx: query_chrom_idx,
                        mate_start: start_query as u32,
                        mate_end: end_query as u32,
                        strand: if strand < 0 { b'-' } else { b'+' },
                        identity: (identity * 10000.0).round() as u16,
                        cs_data,
                    }));
                };

                for anchor in &anchors {
                    let strand: i8 = if anchor.same_strand { 1 } else { -1 };

                    // Compute query offset for this anchor
                    let mut q_off: u64 = 0;
                    for qi in 0..anchor.query_idx {
                        q_off += seg_lengths.get(&query_steps[qi].seg_name).copied().unwrap_or(0);
                    }
                    if need_flip {
                        let seg_len = anchor.seg_len;
                        q_off = query_total_len - q_off - seg_len;
                    }
                    let q_end = q_off + anchor.seg_len;

                    if block_start_ref < 0 || strand != block_strand {
                        // Flush previous block and start new one
                        if block_start_ref >= 0 {
                            flush_block(
                                &mut all_records, ref_chrom_idx, query_genome_idx, query_chrom_idx,
                                block_start_ref as u64, block_end_ref,
                                block_start_query, block_end_query,
                                block_strand, &block_cs,
                            );
                        }
                        block_start_ref = anchor.ref_offset as i64;
                        block_end_ref = anchor.ref_offset + anchor.seg_len;
                        block_start_query = q_off;
                        block_end_query = q_end;
                        block_strand = strand;
                        block_cs = format!(":{}", anchor.seg_len);
                        block_prev_ref_idx = anchor.ref_idx as i64;
                        block_prev_query_idx = anchor.query_idx as i64;
                        continue;
                    }

                    // Check for gap between this anchor and previous
                    let ref_gap = anchor.ref_offset as i64 - block_end_ref as i64;
                    let query_gap = q_off as i64 - block_end_query as i64;

                    if ref_gap < 0 || query_gap < 0 {
                        // Overlap or out-of-order — flush and start new block
                        flush_block(
                            &mut all_records, ref_chrom_idx, query_genome_idx, query_chrom_idx,
                            block_start_ref as u64, block_end_ref,
                            block_start_query, block_end_query,
                            block_strand, &block_cs,
                        );
                        block_start_ref = anchor.ref_offset as i64;
                        block_end_ref = anchor.ref_offset + anchor.seg_len;
                        block_start_query = q_off;
                        block_end_query = q_end;
                        block_cs = format!(":{}", anchor.seg_len);
                        block_prev_ref_idx = anchor.ref_idx as i64;
                        block_prev_query_idx = anchor.query_idx as i64;
                        continue;
                    }

                    // Handle bubble between previous anchor and this one
                    if ref_gap > 0 || query_gap > 0 {
                        // Collect ref sequence in the gap
                        let mut ref_bubble_seq = String::new();
                        for ri in (block_prev_ref_idx as usize + 1)..anchor.ref_idx {
                            ref_bubble_seq.push_str(&get_seg_sequence(
                                &ref_steps[ri].seg_name,
                                ref_steps[ri].orient,
                                seg_sequences,
                            ));
                        }

                        // Collect query sequence in the gap
                        let mut query_bubble_seq = String::new();
                        let q_start_idx = block_prev_query_idx as usize + 1;
                        let q_end_idx = anchor.query_idx;
                        for qi in q_start_idx..q_end_idx {
                            let effective_orient = if need_flip { !query_steps[qi].orient } else { query_steps[qi].orient };
                            query_bubble_seq.push_str(&get_seg_sequence(
                                &query_steps[qi].seg_name,
                                effective_orient,
                                seg_sequences,
                            ));
                        }

                        if !ref_bubble_seq.is_empty() && !query_bubble_seq.is_empty() {
                            // Both have sequence — compare base by base
                            let bubble_cs = compute_cs_from_sequences(&ref_bubble_seq, &query_bubble_seq);
                            block_cs.push_str(&bubble_cs);
                        } else if !ref_bubble_seq.is_empty() {
                            // Deletion in query
                            block_cs.push('-');
                            block_cs.push_str(&ref_bubble_seq);
                        } else if !query_bubble_seq.is_empty() {
                            // Insertion in query
                            block_cs.push('+');
                            block_cs.push_str(&query_bubble_seq);
                        }
                    }

                    // Add the anchor's matching bases
                    block_cs.push_str(&format!(":{}", anchor.seg_len));
                    block_end_ref = anchor.ref_offset + anchor.seg_len;
                    block_end_query = q_end;
                    block_prev_ref_idx = anchor.ref_idx as i64;
                    block_prev_query_idx = anchor.query_idx as i64;
                }

                // Flush final block
                if block_start_ref >= 0 {
                    flush_block(
                        &mut all_records, ref_chrom_idx, query_genome_idx, query_chrom_idx,
                        block_start_ref as u64, block_end_ref,
                        block_start_query, block_end_query,
                        block_strand, &block_cs,
                    );
                }
            }
        }
    }

    eprintln!("  {} alignment records from {} genome pairs", all_records.len(), genome_names.len() - 1);

    // Sort by (chrom_idx, ref_start)
    all_records.sort_by(|a, b| {
        a.0.cmp(&b.0).then(a.1.ref_start.cmp(&b.1.ref_start))
    });

    // Write aln.bin and aln.idx using the same logic as bed_to_bin
    let bin_path = format!("{}.aln.bin", output_prefix);
    let idx_path = format!("{}.aln.idx", output_prefix);

    let mut bin_out = BufWriter::new(File::create(&bin_path).expect("create aln.bin"));
    let mut byte_offset: u64 = 0;
    let mut chrom_max_end: HashMap<u16, u32> = HashMap::new();
    let mut chrom_bin_offsets: HashMap<u16, Vec<(u32, u64)>> = HashMap::new();

    for (ci, rec) in &all_records {
        let bin_idx = rec.ref_start / BIN_SIZE as u32;
        chrom_bin_offsets.entry(*ci).or_default().push((bin_idx, byte_offset));
        let end = chrom_max_end.entry(*ci).or_insert(0);
        if rec.ref_end > *end { *end = rec.ref_end; }
        rec.write_to(&mut bin_out);
        byte_offset += rec.byte_len() as u64;
    }
    drop(bin_out);
    let total_bytes = byte_offset;

    // Write index
    let mut idx_out = BufWriter::new(File::create(&idx_path).expect("create aln.idx"));
    idx_out.write_all(b"ALNI").unwrap();
    idx_out.write_all(&[1u8]).unwrap();
    idx_out.write_all(&(genome_names.len() as u16).to_le_bytes()).unwrap();
    for name in &genome_names {
        write_length_prefixed_string(&mut idx_out, name);
    }
    idx_out.write_all(&(chrom_names.len() as u16).to_le_bytes()).unwrap();
    for name in &chrom_names {
        write_length_prefixed_string(&mut idx_out, name);
    }

    for ci in 0..chrom_names.len() as u16 {
        let chrom_len = chrom_max_end.get(&ci).copied().unwrap_or(0);
        let num_bins = if chrom_len > 0 { (chrom_len + BIN_SIZE as u32 - 1) / BIN_SIZE as u32 } else { 0 };
        idx_out.write_all(&ci.to_le_bytes()).unwrap();
        idx_out.write_all(&chrom_len.to_le_bytes()).unwrap();
        idx_out.write_all(&num_bins.to_le_bytes()).unwrap();

        let mut offsets = vec![total_bytes; (num_bins + 1) as usize];
        if let Some(entries) = chrom_bin_offsets.get(&ci) {
            for &(bin_idx, off) in entries {
                if (bin_idx as usize) < offsets.len() {
                    if off < offsets[bin_idx as usize] { offsets[bin_idx as usize] = off; }
                }
            }
            let mut min_so_far = total_bytes;
            for i in (0..offsets.len()).rev() {
                if offsets[i] < min_so_far { min_so_far = offsets[i]; }
                offsets[i] = min_so_far;
            }
        }
        for off in &offsets {
            idx_out.write_all(&off.to_le_bytes()).unwrap();
        }
    }
    drop(idx_out);

    eprintln!("  Wrote {} ({} bytes)", bin_path, total_bytes);
    eprintln!("  Wrote {}", idx_path);
}

fn bed_to_bin(input_path: &str, output_prefix: Option<&str>) {
    let prefix = output_prefix
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            input_path
                .trim_end_matches(".tbi")
                .trim_end_matches(".gz")
                .trim_end_matches(".bed")
                .trim_end_matches(".aln")
                .to_string()
        });

    let bin_path = format!("{}.aln.bin", prefix);
    let idx_path = format!("{}.aln.idx", prefix);

    eprintln!("Reading {}", input_path);

    // Pass 1: read all records, collect genome/chrom names, sort
    let mut genome_names: Vec<String> = Vec::new();
    let mut genome_map: HashMap<String, u16> = HashMap::new();
    let mut chrom_names: Vec<String> = Vec::new();
    let mut chrom_map: HashMap<String, u16> = HashMap::new();

    struct RawRecord {
        chrom_idx: u16,
        rec: AlnRecord,
    }

    let mut records: Vec<RawRecord> = Vec::new();
    let mut line_count: u64 = 0;

    // Read through gzip since aln.bed.gz is bgzip-compressed
    for line in open_file(input_path).lines() {
        let line = line.expect("read error");
        if line.starts_with('#') || line.is_empty() {
            continue;
        }

        let cols: Vec<&str> = line.splitn(9, '\t').collect();
        if cols.len() < 8 {
            continue;
        }

        let ref_path = cols[0];
        let ref_start: u32 = cols[1].parse().unwrap_or(0);
        let ref_end: u32 = cols[2].parse().unwrap_or(0);
        let query_genome = cols[3];
        let mate_chrom = cols[4];
        let mate_start: u32 = cols[5].parse().unwrap_or(0);
        let mate_end: u32 = cols[6].parse().unwrap_or(0);
        let strand: u8 = if cols[7] == "-" { b'-' } else { b'+' };
        let cs_text = if cols.len() > 8 { cols[8] } else { "" };

        // Register genome name
        let genome_idx = if let Some(&idx) = genome_map.get(query_genome) {
            idx
        } else {
            let idx = genome_names.len() as u16;
            genome_map.insert(query_genome.to_string(), idx);
            genome_names.push(query_genome.to_string());
            idx
        };

        // Register ref chrom (the tabix ref path, used as chrom in the index)
        let chrom_idx = if let Some(&idx) = chrom_map.get(ref_path) {
            idx
        } else {
            let idx = chrom_names.len() as u16;
            chrom_map.insert(ref_path.to_string(), idx);
            chrom_names.push(ref_path.to_string());
            idx
        };

        // Register mate chrom
        let mate_chrom_idx = if let Some(&idx) = chrom_map.get(mate_chrom) {
            idx
        } else {
            let idx = chrom_names.len() as u16;
            chrom_map.insert(mate_chrom.to_string(), idx);
            chrom_names.push(mate_chrom.to_string());
            idx
        };

        let identity = compute_identity_from_cs(cs_text);
        let identity_u16 = (identity * 10000.0).round() as u16;
        let cs_data = encode_cs_binary(cs_text);

        records.push(RawRecord {
            chrom_idx,
            rec: AlnRecord {
                ref_start,
                ref_end,
                query_genome_idx: genome_idx,
                mate_chrom_idx,
                mate_start,
                mate_end,
                strand,
                identity: identity_u16,
                cs_data,
            },
        });

        line_count += 1;
    }

    eprintln!("  {} records, {} genomes, {} chroms", line_count, genome_names.len(), chrom_names.len());

    // Sort by (chrom_idx, ref_start)
    records.sort_by(|a, b| {
        a.chrom_idx.cmp(&b.chrom_idx)
            .then(a.rec.ref_start.cmp(&b.rec.ref_start))
    });

    // Pass 2: write aln.bin and build per-chrom bin offset arrays
    let mut bin_out = BufWriter::new(File::create(&bin_path).expect("create aln.bin"));
    let mut byte_offset: u64 = 0;

    // chrom_idx → (max_ref_end, Vec<(bin_index, byte_offset)>)
    let mut chrom_max_end: HashMap<u16, u32> = HashMap::new();
    // For each chrom, track the byte offset at the start of each 16kb bin
    let mut chrom_bin_offsets: HashMap<u16, Vec<(u32, u64)>> = HashMap::new();

    for raw in &records {
        let ci = raw.chrom_idx;
        let bin_idx = raw.rec.ref_start / BIN_SIZE;

        let offsets = chrom_bin_offsets.entry(ci).or_insert_with(Vec::new);
        offsets.push((bin_idx, byte_offset));

        let end = chrom_max_end.entry(ci).or_insert(0);
        if raw.rec.ref_end > *end {
            *end = raw.rec.ref_end;
        }

        raw.rec.write_to(&mut bin_out);
        byte_offset += raw.rec.byte_len() as u64;
    }
    drop(bin_out);

    let total_bytes = byte_offset;

    // Pass 3: write aln.idx
    let mut idx_out = BufWriter::new(File::create(&idx_path).expect("create aln.idx"));

    // Header
    idx_out.write_all(b"ALNI").unwrap();
    idx_out.write_all(&[1u8]).unwrap(); // version

    idx_out.write_all(&(genome_names.len() as u16).to_le_bytes()).unwrap();
    for name in &genome_names {
        write_length_prefixed_string(&mut idx_out, name);
    }

    idx_out.write_all(&(chrom_names.len() as u16).to_le_bytes()).unwrap();
    for name in &chrom_names {
        write_length_prefixed_string(&mut idx_out, name);
    }

    // Per-chrom index sections (in order of chrom_idx)
    for ci in 0..chrom_names.len() as u16 {
        let chrom_len = chrom_max_end.get(&ci).copied().unwrap_or(0);
        let num_bins = if chrom_len > 0 { (chrom_len + BIN_SIZE - 1) / BIN_SIZE } else { 0 };

        idx_out.write_all(&ci.to_le_bytes()).unwrap();
        idx_out.write_all(&chrom_len.to_le_bytes()).unwrap();
        idx_out.write_all(&num_bins.to_le_bytes()).unwrap();

        // Build the bin offset array: for each bin, store the byte offset of the
        // first record whose ref_start falls in that bin.
        // Final entry = total_bytes (sentinel for computing range end).
        let mut offsets = vec![total_bytes; (num_bins + 1) as usize];

        if let Some(entries) = chrom_bin_offsets.get(&ci) {
            for &(bin_idx, off) in entries {
                if (bin_idx as usize) < offsets.len() {
                    if off < offsets[bin_idx as usize] {
                        offsets[bin_idx as usize] = off;
                    }
                }
            }
            // Forward-fill: bins with no records should point to the next bin
            // that has records (or total_bytes if none follow).
            // We do this by scanning backwards and carrying the minimum.
            let mut min_so_far = total_bytes;
            for i in (0..offsets.len()).rev() {
                if offsets[i] < min_so_far {
                    min_so_far = offsets[i];
                }
                offsets[i] = min_so_far;
            }
        }

        for off in &offsets {
            idx_out.write_all(&off.to_le_bytes()).unwrap();
        }
    }

    drop(idx_out);

    eprintln!("  Wrote {} ({} bytes)", bin_path, total_bytes);
    eprintln!("  Wrote {}", idx_path);
    eprintln!("Done.");
}
