#!/usr/bin/env bash
# Linux/macOS counterpart to build.ps1. Keep the two in sync: these flags decide the
# numerical behavior of every published simulation, so a difference between platforms
# silently produces artifacts that disagree with the committed golden reports.
set -euo pipefail

configuration=Release
profiling=0

usage() {
    cat <<'EOF'
Usage: wasm/build.sh [-c|--configuration Release|Debug] [-p|--profiling]

  -c, --configuration  Release (default) or Debug.
  -p, --profiling      Emit the separate warriorsim.profile.js artifact.
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -c|--configuration|-Configuration)
            [ $# -ge 2 ] || { echo "Missing value for $1" >&2; exit 1; }
            configuration="$2"
            shift 2
            ;;
        --configuration=*) configuration="${1#*=}"; shift ;;
        -p|--profiling|-Profiling) profiling=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Unknown argument: $1" >&2; usage >&2; exit 1 ;;
    esac
done

case "$configuration" in
    Release|Debug) ;;
    *) echo "Configuration must be Release or Debug, got: $configuration" >&2; exit 1 ;;
esac

wasmRoot="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repoRoot="$(dirname "$wasmRoot")"
outputDir="$wasmRoot/dist"
cacheDir="$wasmRoot/.em-cache"
if [ "$profiling" -eq 1 ]; then outputName=warriorsim.profile.js; else outputName=warriorsim.js; fi
mkdir -p "$outputDir" "$cacheDir"

if ! command -v em++ >/dev/null 2>&1; then
    emsdkRoot="${EMSDK:-$(dirname "$repoRoot")/emsdk}"
    emsdkEnv="$emsdkRoot/emsdk_env.sh"
    if [ ! -f "$emsdkEnv" ]; then
        echo "em++ is not on PATH and no emsdk_env.sh was found via EMSDK or sibling ../emsdk" >&2
        exit 1
    fi
    # emsdk_env.sh is not written for `set -eu`; relax while it runs and verify afterwards.
    set +eu
    # shellcheck source=/dev/null
    . "$emsdkEnv" >/dev/null 2>&1
    set -eu
    if ! command -v em++ >/dev/null 2>&1; then
        echo "Sourcing $emsdkEnv did not put em++ on PATH" >&2
        exit 1
    fi
fi

common=(
    -std=c++20
    -sWASM=1
    -sMODULARIZE=1
    -sEXPORT_ES6=1
    -sEXPORT_NAME=createWarriorSim
    -sENVIRONMENT=worker,node
    -sINCOMING_MODULE_JS_API=locateFile,wasmBinary
    -sALLOW_MEMORY_GROWTH=1
    -sSTACK_SIZE=262144
    -sFILESYSTEM=0
    -sASSERTIONS=1
    -fwasm-exceptions
    -sEXCEPTION_STACK_TRACES=1
    --bind
    -I "$wasmRoot/src"
    "$wasmRoot/src/engine.cpp"
    "$wasmRoot/src/player.cpp"
    "$wasmRoot/src/simulation.cpp"
    "$wasmRoot/src/spells.cpp"
    "$wasmRoot/src/auras.cpp"
    -o "$outputDir/$outputName"
)

export EM_CACHE="$cacheDir"
if [ "$configuration" = Release ]; then
    release=(-O3 -flto -msimd128 -DNDEBUG -sASSERTIONS=0)
    if [ "$profiling" -eq 1 ]; then release+=(--profiling-funcs); fi
    em++ "${common[@]}" "${release[@]}"
else
    em++ "${common[@]}" -O0 -gsource-map
fi
