#!/usr/bin/env python3
"""Convert PLINK .ld output to ldmat HDF5 format"""
import sys
import pandas as pd
import numpy as np
import h5py

def plink_to_ldmat(ld_file, output_h5, maf_filter=None):
    # Read PLINK LD output
    print(f"Reading {ld_file}...")
    df = pd.read_csv(ld_file, sep=r'\s+')
    print(f"Loaded {len(df)} LD pairs")
    
    # Get unique positions
    positions_a = df[['CHR_A', 'BP_A', 'SNP_A']].drop_duplicates()
    positions_b = df[['CHR_B', 'BP_B', 'SNP_B']].drop_duplicates()
    positions_a.columns = ['CHR', 'BP', 'SNP']
    positions_b.columns = ['CHR', 'BP', 'SNP']
    
    all_positions = pd.concat([positions_a, positions_b]).drop_duplicates()
    all_positions = all_positions.sort_values('BP')
    print(f"Found {len(all_positions)} unique SNPs")
    
    # Create position to index mapping
    pos_to_idx = {bp: i for i, bp in enumerate(all_positions['BP'].values)}
    
    # Build LD matrix
    n = len(all_positions)
    ld_matrix = np.zeros((n, n), dtype=np.float32)
    np.fill_diagonal(ld_matrix, 1.0)  # Self-LD = 1
    
    for _, row in df.iterrows():
        i = pos_to_idx.get(row['BP_A'])
        j = pos_to_idx.get(row['BP_B'])
        if i is not None and j is not None:
            ld_matrix[i, j] = row['R2']
            ld_matrix[j, i] = row['R2']  # Symmetric
    
    # Get chromosome
    chrom = str(all_positions['CHR'].iloc[0])
    start_locus = int(all_positions['BP'].min())
    end_locus = int(all_positions['BP'].max())
    
    print(f"Chromosome: {chrom}, range: {start_locus}-{end_locus}")
    
    # Write HDF5 in ldmat format
    print(f"Writing {output_h5}...")
    with h5py.File(output_h5, 'w') as f:
        # Root attributes
        f.attrs['version'] = '0.0.2'
        f.attrs['chromosome'] = chrom
        f.attrs['start_locus'] = start_locus
        f.attrs['end_locus'] = end_locus
        f.attrs['min_score'] = 0.0
        f.attrs['kept_decimal_places'] = 4
        
        # Create single chunk with all data
        chunk_name = f'chunk_{start_locus}'
        grp = f.create_group(chunk_name)
        grp.attrs['start_locus'] = start_locus
        grp.attrs['end_locus'] = end_locus
        
        # Store LD values
        grp.create_dataset('LD_values', data=ld_matrix, compression='gzip')
        
        # Store positions
        grp.create_dataset('positions', data=all_positions['BP'].values.astype(np.int64), compression='gzip')
        
        # Store names
        names = all_positions['SNP'].values.astype('S')
        grp.create_dataset('names', data=names, compression='gzip')
    
    print(f"Done! Created {output_h5}")

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: plink_to_ldmat.py input.ld output.h5")
        sys.exit(1)
    plink_to_ldmat(sys.argv[1], sys.argv[2])
