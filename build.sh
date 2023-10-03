#!/usr/bin/env bash

set -x
(cd pitch && cargo build && wasm-pack build --target web)
cp -r pitch/pkg pkg
rm pkg/.gitignore
ls -lah