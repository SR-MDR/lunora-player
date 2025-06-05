#!/bin/bash

# Lunora Player - Domain and SSL Setup Helper
# This script helps set up domain and SSL certificate for production deployment

set -e

# Configuration
AWS_REGION="us-west-2"
AWS_PROFILE="lunora-media"
CERT_REGION="us-east-1"  # ACM certificates for CloudFront must be in us-east-1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_header() {
    echo ""
    echo "=========================================="
    echo "  $1"
    echo "=========================================="
}

# Check if domain is provided
check_domain() {
    if [ -z "$DOMAIN_NAME" ]; then
        print_error "Domain name is required"
        echo "Usage: $0 --domain yourdomain.com [options]"
        echo "Or set DOMAIN_NAME environment variable"
        exit 1
    fi
    
    print_status "Setting up domain: $DOMAIN_NAME"
}

# Check if Route 53 hosted zone exists
check_hosted_zone() {
    print_header "Checking Route 53 Hosted Zone"
    
    local hosted_zones=$(aws route53 list-hosted-zones \
        --profile $AWS_PROFILE \
        --query "HostedZones[?Name=='${DOMAIN_NAME}.']" \
        --output json)
    
    local zone_count=$(echo "$hosted_zones" | jq length)
    
    if [ "$zone_count" -eq 0 ]; then
        print_warning "No hosted zone found for $DOMAIN_NAME"
        
        if [ "$CREATE_HOSTED_ZONE" = "true" ]; then
            create_hosted_zone
        else
            print_status "To create hosted zone, run with --create-zone flag"
            print_status "Or create manually in AWS Console"
        fi
    else
        local zone_id=$(echo "$hosted_zones" | jq -r '.[0].Id' | sed 's|/hostedzone/||')
        print_success "Found hosted zone: $zone_id"
        export HOSTED_ZONE_ID="$zone_id"
        
        # Show name servers
        local name_servers=$(aws route53 get-hosted-zone \
            --id "$zone_id" \
            --profile $AWS_PROFILE \
            --query 'DelegationSet.NameServers' \
            --output json)
        
        print_status "Name servers for $DOMAIN_NAME:"
        echo "$name_servers" | jq -r '.[]' | sed 's/^/  /'
    fi
}

# Create Route 53 hosted zone
create_hosted_zone() {
    print_status "Creating hosted zone for $DOMAIN_NAME..."
    
    local caller_reference=$(date +%s)
    local result=$(aws route53 create-hosted-zone \
        --name "$DOMAIN_NAME" \
        --caller-reference "$caller_reference" \
        --profile $AWS_PROFILE \
        --output json)
    
    local zone_id=$(echo "$result" | jq -r '.HostedZone.Id' | sed 's|/hostedzone/||')
    export HOSTED_ZONE_ID="$zone_id"
    
    print_success "Created hosted zone: $zone_id"
    
    # Show name servers
    local name_servers=$(echo "$result" | jq -r '.DelegationSet.NameServers[]')
    print_status "Configure these name servers with your domain registrar:"
    echo "$name_servers" | sed 's/^/  /'
}

# Check for existing SSL certificate
check_ssl_certificate() {
    print_header "Checking SSL Certificate"
    
    local certificates=$(aws acm list-certificates \
        --region $CERT_REGION \
        --profile $AWS_PROFILE \
        --query "CertificateSummaryList[?DomainName=='*.${DOMAIN_NAME}' || DomainName=='${DOMAIN_NAME}']" \
        --output json)
    
    local cert_count=$(echo "$certificates" | jq length)
    
    if [ "$cert_count" -eq 0 ]; then
        print_warning "No SSL certificate found for $DOMAIN_NAME"
        
        if [ "$CREATE_CERTIFICATE" = "true" ]; then
            create_ssl_certificate
        else
            print_status "To create certificate, run with --create-cert flag"
            print_status "Or create manually in AWS Console (us-east-1 region)"
        fi
    else
        local cert_arn=$(echo "$certificates" | jq -r '.[0].CertificateArn')
        local cert_status=$(aws acm describe-certificate \
            --certificate-arn "$cert_arn" \
            --region $CERT_REGION \
            --profile $AWS_PROFILE \
            --query 'Certificate.Status' \
            --output text)
        
        print_success "Found certificate: $cert_arn"
        print_status "Certificate status: $cert_status"
        
        if [ "$cert_status" = "ISSUED" ]; then
            export CERTIFICATE_ARN="$cert_arn"
            print_success "Certificate is ready for use"
        else
            print_warning "Certificate is not yet issued"
            print_status "Check validation status in AWS Console"
        fi
    fi
}

# Create SSL certificate
create_ssl_certificate() {
    print_status "Requesting SSL certificate for $DOMAIN_NAME..."
    
    local result=$(aws acm request-certificate \
        --domain-name "*.${DOMAIN_NAME}" \
        --subject-alternative-names "$DOMAIN_NAME" \
        --validation-method DNS \
        --region $CERT_REGION \
        --profile $AWS_PROFILE \
        --output json)
    
    local cert_arn=$(echo "$result" | jq -r '.CertificateArn')
    export CERTIFICATE_ARN="$cert_arn"
    
    print_success "Certificate requested: $cert_arn"
    print_warning "Certificate validation required"
    
    # Wait a moment for validation records to be available
    sleep 5
    
    # Get validation records
    local cert_details=$(aws acm describe-certificate \
        --certificate-arn "$cert_arn" \
        --region $CERT_REGION \
        --profile $AWS_PROFILE \
        --output json)
    
    local validation_records=$(echo "$cert_details" | jq '.Certificate.DomainValidationOptions')
    
    if [ -n "$HOSTED_ZONE_ID" ] && [ "$AUTO_VALIDATE" = "true" ]; then
        print_status "Creating DNS validation records..."
        create_validation_records "$validation_records"
    else
        print_status "Manual validation required. Create these DNS records:"
        echo "$validation_records" | jq -r '.[] | "  \(.ResourceRecord.Name) CNAME \(.ResourceRecord.Value)"'
    fi
}

# Create DNS validation records
create_validation_records() {
    local validation_records="$1"
    
    local record_count=$(echo "$validation_records" | jq length)
    
    for i in $(seq 0 $((record_count - 1))); do
        local record=$(echo "$validation_records" | jq ".[$i]")
        local name=$(echo "$record" | jq -r '.ResourceRecord.Name')
        local value=$(echo "$record" | jq -r '.ResourceRecord.Value')
        
        print_status "Creating validation record: $name"
        
        local change_batch=$(cat <<EOF
{
    "Changes": [{
        "Action": "CREATE",
        "ResourceRecordSet": {
            "Name": "$name",
            "Type": "CNAME",
            "TTL": 300,
            "ResourceRecords": [{"Value": "$value"}]
        }
    }]
}
EOF
)
        
        aws route53 change-resource-record-sets \
            --hosted-zone-id "$HOSTED_ZONE_ID" \
            --change-batch "$change_batch" \
            --profile $AWS_PROFILE \
            --output json > /dev/null
        
        print_success "Validation record created"
    done
    
    print_status "Waiting for certificate validation (this may take 5-30 minutes)..."
    print_status "You can check status with: aws acm describe-certificate --certificate-arn $CERTIFICATE_ARN --region $CERT_REGION"
}

# Generate deployment command
generate_deployment_command() {
    print_header "Deployment Command"
    
    if [ -n "$CERTIFICATE_ARN" ]; then
        print_success "Ready for production deployment!"
        print_status ""
        print_status "Run the following command to deploy:"
        print_status ""
        echo "export DOMAIN_NAME=\"$DOMAIN_NAME\""
        echo "export CERTIFICATE_ARN=\"$CERTIFICATE_ARN\""
        echo ""
        echo "./scripts/deploy-production-srt.sh \\"
        echo "    --domain \"$DOMAIN_NAME\" \\"
        echo "    --certificate \"$CERTIFICATE_ARN\""
        print_status ""
    else
        print_warning "Certificate not ready yet"
        print_status "Complete certificate validation first"
    fi
}

# Main function
main() {
    print_header "Lunora Player - Domain and SSL Setup"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --create-zone)
                CREATE_HOSTED_ZONE="true"
                shift
                ;;
            --create-cert)
                CREATE_CERTIFICATE="true"
                shift
                ;;
            --auto-validate)
                AUTO_VALIDATE="true"
                shift
                ;;
            --profile)
                AWS_PROFILE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 --domain DOMAIN [options]"
                echo "Options:"
                echo "  --domain DOMAIN        Domain name (e.g., yourdomain.com)"
                echo "  --create-zone          Create Route 53 hosted zone if not exists"
                echo "  --create-cert          Create SSL certificate if not exists"
                echo "  --auto-validate        Automatically create DNS validation records"
                echo "  --profile PROFILE      AWS profile (default: lunora-media)"
                echo "  --help                 Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 --domain example.com --create-zone --create-cert --auto-validate"
                echo "  $0 --domain example.com  # Check existing setup"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_domain
    check_hosted_zone
    check_ssl_certificate
    generate_deployment_command
    
    print_header "Setup Complete"
}

# Run main function with all arguments
main "$@"
