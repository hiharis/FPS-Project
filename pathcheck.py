"""
Scans the Website/ folder and dumps:
  - Folder tree
  - Every file path with size
  - Total size

Output: website_structure.txt (saved in the same folder)

Usage:
    cd C:\\Users\\CFM\\Desktop\\FPS_SHOOTER\\Website
    py scan_tree.py
"""

import os

# ---------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------
ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.join(ROOT, "website_structure.txt")

# Folders to skip (they're huge and irrelevant right now)
SKIP_DIRS = {
    ".git",
    "__pycache__",
    "node_modules",
}

# File extensions that are considered "big assets" (report with size)
ASSET_EXTS = {".glb", ".gltf", ".bin", ".fbx", ".obj", ".mtl", ".mp3", ".wav", ".jpg", ".jpeg", ".png", ".webp"}


# ---------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------
def human_size(num_bytes):
    """Turn 1234567 into '1.18 MB'."""
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024:
            return f"{num_bytes:.2f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.2f} TB"


def walk_tree(root):
    """
    Returns (tree_lines, file_records)
      tree_lines   : list of formatted lines to print in the tree section
      file_records : list of dicts {path, rel_path, size, ext}
    """
    tree_lines = []
    file_records = []

    def _walk(folder, prefix=""):
        try:
            entries = sorted(os.listdir(folder))
        except PermissionError:
            tree_lines.append(f"{prefix}[Permission denied]")
            return

        # Split into dirs and files
        dirs, files = [], []
        for name in entries:
            full = os.path.join(folder, name)
            if name in SKIP_DIRS:
                continue
            if os.path.isdir(full):
                dirs.append(name)
            else:
                files.append(name)

        # Print files first
        for i, name in enumerate(files):
            full = os.path.join(folder, name)
            try:
                size = os.path.getsize(full)
            except OSError:
                size = 0
            is_last = (i == len(files) - 1) and not dirs
            branch = "└── " if is_last else "├── "
            tree_lines.append(f"{prefix}{branch}{name}  ({human_size(size)})")

            ext = os.path.splitext(name)[1].lower()
            file_records.append({
                "path": full,
                "rel_path": os.path.relpath(full, ROOT).replace("\\", "/"),
                "size": size,
                "ext": ext,
            })

        # Then directories
        for i, name in enumerate(dirs):
            full = os.path.join(folder, name)
            is_last = (i == len(dirs) - 1)
            branch = "└── " if is_last else "├── "
            tree_lines.append(f"{prefix}{branch}{name}/")

            next_prefix = prefix + ("    " if is_last else "│   ")
            _walk(full, next_prefix)

    tree_lines.append(f"{os.path.basename(ROOT)}/")
    _walk(ROOT)
    return tree_lines, file_records


# ---------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------
def main():
    print(f"Scanning: {ROOT}\n")

    tree_lines, file_records = walk_tree(ROOT)

    # --- 1. Tree view ---
    tree_section = ["=" * 70, "FOLDER TREE", "=" * 70, ""]
    tree_section.extend(tree_lines)
    tree_section.append("")

    # --- 2. Assets summary (only big files) ---
    assets = [f for f in file_records if f["ext"] in ASSET_EXTS]
    assets.sort(key=lambda f: -f["size"])

    asset_section = ["=" * 70, "ASSET FILES (sorted by size, biggest first)", "=" * 70, ""]
    for f in assets:
        asset_section.append(f"  {human_size(f['size']):>10}   {f['rel_path']}")
    asset_section.append("")

    # --- 3. Extension stats ---
    ext_counts = {}
    ext_sizes = {}
    for f in file_records:
        ext = f["ext"] or "(no ext)"
        ext_counts[ext] = ext_counts.get(ext, 0) + 1
        ext_sizes[ext] = ext_sizes.get(ext, 0) + f["size"]

    ext_section = ["=" * 70, "FILE TYPES", "=" * 70, ""]
    for ext in sorted(ext_counts, key=lambda e: -ext_sizes[e]):
        ext_section.append(
            f"  {ext:<12}  {ext_counts[ext]:>4} files   {human_size(ext_sizes[ext]):>10}"
        )
    ext_section.append("")

    # --- 4. Totals ---
    total_files = len(file_records)
    total_size = sum(f["size"] for f in file_records)

    totals_section = ["=" * 70, "TOTALS", "=" * 70, ""]
    totals_section.append(f"  Files:  {total_files}")
    totals_section.append(f"  Size:   {human_size(total_size)}")
    totals_section.append("")

    # --- 5. Full flat file list (every single file) ---
    flat_section = ["=" * 70, "FULL FILE LIST (every file, relative path)", "=" * 70, ""]
    for f in sorted(file_records, key=lambda x: x["rel_path"]):
        flat_section.append(f"  {f['rel_path']}")
    flat_section.append("")

    # --- Write everything ---
    with open(OUTPUT_FILE, "w", encoding="utf-8") as fh:
        for section in (tree_section, asset_section, ext_section, totals_section, flat_section):
            fh.write("\n".join(section))
            fh.write("\n\n")

    print(f"Done.")
    print(f"  {total_files} files, {human_size(total_size)}")
    print(f"  Output saved to: {OUTPUT_FILE}")
    print()
    print("Paste the contents of website_structure.txt back to me.")


if __name__ == "__main__":
    main()