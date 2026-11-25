#!/usr/bin/env python3
import os
import zipfile
import sys

def create_project_zip(output_path="public/dcu-child-dedication-portal.zip"):
    root_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    os.makedirs(os.path.dirname(os.path.join(root_dir, output_path)), exist_ok=True)
    full_output_path = os.path.join(root_dir, output_path)

    # Exclusions
    exclude_dirs = {
        'node_modules', '.git', '.cache', 'dist', '.vercel',
        '.aistudio', '__pycache__', '.next'
    }
    exclude_files = {
        'dcu-child-dedication-portal.zip', '.DS_Store', 'bun.lockb'
    }

    print(f"Creating project ZIP from: {root_dir}")
    print(f"Destination: {full_output_path}")

    file_count = 0
    with zipfile.ZipFile(full_output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.git')]

            for file in files:
                if file in exclude_files:
                    continue
                if file.endswith('.zip'):
                    continue
                
                abs_file = os.path.join(root, file)
                rel_path = os.path.relpath(abs_file, root_dir)
                zipf.write(abs_file, rel_path)
                file_count += 1

    # Also copy to root for convenience
    root_zip = os.path.join(root_dir, 'dcu-child-dedication-portal.zip')
    if full_output_path != root_zip:
        import shutil
        shutil.copy2(full_output_path, root_zip)

    size_kb = os.path.getsize(full_output_path) / 1024
    print(f"Successfully archived {file_count} files ({size_kb:.1f} KB) to {output_path} and root ZIP.")
    return full_output_path

if __name__ == '__main__':
    create_project_zip()
