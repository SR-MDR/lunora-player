#!/bin/bash

# Add HLS Player destination to production DynamoDB
set -e

# Configuration
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
TABLE_NAME="lunora-player-destinations-prod"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Adding HLS Player destination to production...${NC}"

# Generate timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)

# Add HLS destination to DynamoDB
aws dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --item '{
        "destination_id": {"S": "dest_hls_player_001"},
        "name": {"S": "HLS Player"},
        "platform": {"S": "hls"},
        "enabled": {"BOOL": true},
        "created_at": {"S": "'$TIMESTAMP'"},
        "updated_at": {"S": "'$TIMESTAMP'"}
    }' \
    --region "$AWS_REGION" \
    --profile "$AWS_PROFILE"

echo -e "${GREEN}✅ HLS Player destination added successfully!${NC}"
echo
echo "Destination Details:"
echo "  ID: dest_hls_player_001"
echo "  Name: HLS Player"
echo "  Platform: hls"
echo "  Status: Enabled"
echo
echo "You can now:"
echo "1. Go to https://d35au6zpsr51nc.cloudfront.net/"
echo "2. The HLS Player should appear in your destinations list"
echo "3. Click 'Start' to begin streaming and open the HLS player"
echo "4. The player will open at: https://d35au6zpsr51nc.cloudfront.net/hls-player.html"
