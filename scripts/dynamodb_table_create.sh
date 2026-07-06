#!/usr/bin/env bash
# Creates the two DynamoDB tables used for chat persistence
# (see docs/superpowers/specs/2026-07-06-chat-persistence-design.md).
# Safe to re-run: skips a table if it already exists.
set -euo pipefail

# Without this, AWS CLI v2 pipes JSON output through a pager (usually
# `less`), which looks like the script has hung at a bare ":" prompt in a
# non-interactive terminal.
export AWS_PAGER=""

REGION="${AWS_REGION:-us-east-1}"

create_table_if_missing() {
  local table_name="$1"
  shift

  if aws dynamodb describe-table --table-name "$table_name" --region "$REGION" >/dev/null 2>&1; then
    echo "Table $table_name already exists, skipping."
    return
  fi

  echo "Creating table $table_name..."
  aws dynamodb create-table \
    --table-name "$table_name" \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    "$@"
}

create_table_if_missing ChatConversations \
  --attribute-definitions AttributeName=userId,AttributeType=S AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=userId,KeyType=HASH AttributeName=sessionId,KeyType=RANGE

create_table_if_missing ChatMessages \
  --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=sortKey,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=sortKey,KeyType=RANGE

echo "Done."
