from __future__ import annotations

import argparse
import json
from pathlib import Path

from ..services.archive_catalog import ArchiveCatalog
from ..services.archive_ingestion import ArchiveIngestionService


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest local satellite imagery into the ORBIVUE archive catalog.")
    parser.add_argument("path", help="File or directory path to ingest.")
    parser.add_argument("--no-recursive", action="store_true", help="Do not recurse when path is a directory.")
    args = parser.parse_args()

    service = ArchiveIngestionService(ArchiveCatalog())
    result = service.ingest_path(Path(args.path), recursive=not args.no_recursive)
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
