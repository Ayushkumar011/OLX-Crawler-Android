#!/bin/bash
export $(cat .env | xargs)
echo "Running database schema push..."
pnpm --filter @workspace/db run push
echo "Starting API server..."
pnpm --filter @workspace/api-server run dev
