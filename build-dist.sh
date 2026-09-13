#!/usr/bin/env bash
# Convenience entry point mirroring build-dist.bat.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/build-dist.sh" "$@"
