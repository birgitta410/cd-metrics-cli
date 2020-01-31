#!/usr/bin/env bash
set -e

if [ -z "$@" ]; then
    npm run cli -- --help
else
    npm run cli -- "$@"
fi
