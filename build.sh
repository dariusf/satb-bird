#!/usr/bin/env bash

(cd pitch && cargo build && wasm-pack build --target web)
cp pitch/pkg pkg
