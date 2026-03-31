#!/usr/bin/env bash
set -euo pipefail

# 启动本地 validator 并在测试后保留运行（模拟 anchor test --detach 行为）
# 用法: ./scripts/test-detach.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LEDGER_DIR="$ROOT_DIR/test-ledger"
LOG="$ROOT_DIR/validator.log"

echo "Starting solana-test-validator (ledger=$LEDGER_DIR)..."
mkdir -p "$LEDGER_DIR"

# 如果已经有 validator 在运行，提示并继续
if pgrep -x solana-test-validator >/dev/null 2>&1; then
  echo "solana-test-validator already running. Will not start a new one."
else
  nohup solana-test-validator --ledger "$LEDGER_DIR" --reset > "$LOG" 2>&1 &
  sleep 3
  echo "solana-test-validator started, log => $LOG"
fi

echo "Ensure Anchor is configured for localnet..."
# 运行前请确认 Anchor.toml provider.cluster = "localnet"

echo "Building programs..."
cd "$ROOT_DIR"
anchor build

echo "Running tests (anchor test --skip-build)..."
anchor test --skip-build || echo "anchor test exited with non-zero status"

echo "Tests finished. Local validator remains running."
echo "To stop it, run: pkill -f solana-test-validator"
echo "Validator log: $LOG"
