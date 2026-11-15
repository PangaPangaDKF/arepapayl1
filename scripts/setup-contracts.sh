#!/usr/bin/env bash
# Installs pinned Solidity deps for contracts/ (D-010). Pins: OpenZeppelin v5.1.0, forge-std v1.9.4.
set -e; cd "$(dirname "$0")/../contracts"
[ -d lib/openzeppelin-contracts ] || forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.1.0
[ -d lib/forge-std ] || forge install --no-git foundry-rs/forge-std@v1.9.4
