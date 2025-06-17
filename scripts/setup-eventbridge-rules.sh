#!/bin/bash

# Setup EventBridge rules for real-time MediaConnect source health monitoring
# This enables 3-5 second detection like AWS Console

set -e

echo "🚀 Setting up EventBridge rules for real-time MediaConnect source health monitoring..."

# Configuration
REGION="us-west-2"
RULE_NAME="lunora-mediaconnect-source-health"
TARGET_LAMBDA_ARN="arn:aws:lambda:us-west-2:372241484305:function:enhanced-streaming-handler"
FLOW_ARN="arn:aws:mediaconnect:us-west-2:372241484305:flow:1-DgdVCAEFAAsHBgVS-e049c6465752:lunora-player-prod-srt-router"

echo "[INFO] Creating EventBridge rule for MediaConnect source health events..."

# Create EventBridge rule to capture MediaConnect source health events
aws events put-rule \
    --region $REGION \
    --name $RULE_NAME \
    --description "Capture MediaConnect source health events for real-time frontend updates" \
    --event-pattern '{
        "source": ["aws.mediaconnect"],
        "detail-type": ["MediaConnect Source Health"],
        "resources": ["'$FLOW_ARN'"]
    }' \
    --state ENABLED

echo "[✓] EventBridge rule created: $RULE_NAME"

# Add Lambda target to the rule
echo "[INFO] Adding Lambda target to EventBridge rule..."

# Create targets JSON file for proper formatting
cat > /tmp/eventbridge-targets.json << 'EOF'
[
    {
        "Id": "1",
        "Arn": "arn:aws:lambda:us-west-2:372241484305:function:enhanced-streaming-handler"
    }
]
EOF

aws events put-targets \
    --region $REGION \
    --rule $RULE_NAME \
    --targets file:///tmp/eventbridge-targets.json

echo "[✓] Lambda target added to EventBridge rule"

# Add permission for EventBridge to invoke Lambda
echo "[INFO] Adding EventBridge permission to Lambda function..."

aws lambda add-permission \
    --region $REGION \
    --function-name enhanced-streaming-handler \
    --statement-id "allow-eventbridge-$RULE_NAME" \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --source-arn "arn:aws:events:$REGION:372241484305:rule/$RULE_NAME" \
    --output text || echo "[INFO] Permission already exists"

echo "[✓] EventBridge permission configured"

echo ""
echo "🎉 EventBridge setup complete!"
echo ""
echo "📊 Configuration Summary:"
echo "  Rule Name: $RULE_NAME"
echo "  Target: $TARGET_LAMBDA_ARN"
echo "  Flow: $FLOW_ARN"
echo "  Region: $REGION"
echo ""
echo "✅ Real-time source health events will now trigger Lambda function"
echo "⚡ Expected detection time: 3-5 seconds (matching AWS Console)"
echo ""
echo "🔍 To test:"
echo "  1. Switch source in MediaConnect Console"
echo "  2. Check Lambda logs for EventBridge events"
echo "  3. Verify frontend updates within 5 seconds"
