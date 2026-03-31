#!/usr/bin/env bash
# deploy.sh — Build and deploy Subtrackr web to S3 + CloudFront
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - S3 bucket created with static website hosting enabled
#   - CloudFront distribution pointing at the S3 bucket
#
# Usage:
#   S3_BUCKET=your-bucket-name CF_DIST_ID=EXXXXXXXXXX ./deploy.sh

set -e

S3_BUCKET="${S3_BUCKET:?Set S3_BUCKET env var, e.g. subtrackr-web}"
CF_DIST_ID="${CF_DIST_ID:?Set CF_DIST_ID env var, e.g. EXXXXXXXXXX}"

echo "Building Expo web export..."
npx expo export --platform web

echo "Syncing to s3://$S3_BUCKET ..."
aws s3 sync dist/ "s3://$S3_BUCKET" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.json"

# HTML and JSON should not be cached aggressively
aws s3 sync dist/ "s3://$S3_BUCKET" \
  --delete \
  --cache-control "public,max-age=0,must-revalidate" \
  --include "index.html" \
  --include "*.json"

echo "Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$CF_DIST_ID" \
  --paths "/*"

echo "Deploy complete."
