#!/usr/bin/env node

// Lunora Player - Production Build Script
// This script builds optimized versions of all frontend applications for production deployment

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BUILD_DIR = 'dist';
const APPS = {
    player: {
        name: 'Video Player',
        files: ['index.html', 'css/player.css', 'js/player.js', 'js/language-selector.js', 'config/player-config.js'],
        outputDir: 'player'
    },
    dashboard: {
        name: 'AWS Dashboard',
        files: ['dashboard.html', 'css/dashboard.css', 'js/dashboard.js', 'config/aws-config.js'],
        outputDir: 'dashboard'
    },
    streaming: {
        name: 'Streaming Control',
        files: [
            'streaming.html', 
            'css/streaming.css', 
            'css/multi-destination.css',
            'js/streaming-control.js', 
            'js/multi-destination.js',
            'config/streaming-presets.js',
            'config/production-config.js'
        ],
        outputDir: 'streaming'
    }
};

// Colors for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
    log('\n==========================================', 'blue');
    log(`  ${message}`, 'bright');
    log('==========================================', 'blue');
}

function logSuccess(message) {
    log(`✓ ${message}`, 'green');
}

function logError(message) {
    log(`✗ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠ ${message}`, 'yellow');
}

// Utility functions
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logSuccess(`Created directory: ${dir}`);
    }
}

function copyFile(src, dest) {
    try {
        const destDir = path.dirname(dest);
        ensureDir(destDir);
        
        let content = fs.readFileSync(src, 'utf8');
        
        // Process file based on type
        if (src.endsWith('.html')) {
            content = processHTML(content, src);
        } else if (src.endsWith('.js')) {
            content = processJavaScript(content, src);
        } else if (src.endsWith('.css')) {
            content = processCSS(content, src);
        }
        
        fs.writeFileSync(dest, content);
        logSuccess(`Copied: ${src} → ${dest}`);
    } catch (error) {
        logError(`Failed to copy ${src}: ${error.message}`);
        throw error;
    }
}

function processHTML(content, filename) {
    // Update API endpoints for production
    content = content.replace(
        /http:\/\/localhost:3000\/api/g,
        'https://YOUR_API_GATEWAY_ID.execute-api.us-west-2.amazonaws.com/prod'
    );
    
    // Add production meta tags
    const metaTags = `
    <meta name="environment" content="production">
    <meta name="build-time" content="${new Date().toISOString()}">
    <meta name="version" content="${getVersion()}">`;
    
    content = content.replace('<head>', `<head>${metaTags}`);
    
    // Minify HTML (basic)
    if (process.env.NODE_ENV === 'production') {
        content = content
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .trim();
    }
    
    return content;
}

function processJavaScript(content, filename) {
    // Update API endpoints for production
    content = content.replace(
        /http:\/\/localhost:3000\/api/g,
        'https://YOUR_API_GATEWAY_ID.execute-api.us-west-2.amazonaws.com/prod'
    );
    
    // Add production configuration
    if (filename.includes('config/')) {
        content = content.replace(
            /environment:\s*['"]development['"]/, 
            'environment: "production"'
        );
    }
    
    // Add build information
    content = `// Built: ${new Date().toISOString()}\n// Version: ${getVersion()}\n${content}`;
    
    return content;
}

function processCSS(content, filename) {
    // Minify CSS (basic)
    if (process.env.NODE_ENV === 'production') {
        content = content
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ') // Collapse whitespace
            .replace(/;\s*}/g, '}') // Remove last semicolon in blocks
            .trim();
    }
    
    return content;
}

function getVersion() {
    try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        return packageJson.version;
    } catch (error) {
        return '1.0.0';
    }
}

function getGitCommit() {
    try {
        return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
        return 'unknown';
    }
}

function createManifest() {
    const manifest = {
        version: getVersion(),
        buildTime: new Date().toISOString(),
        gitCommit: getGitCommit(),
        environment: process.env.NODE_ENV || 'development',
        apps: Object.keys(APPS),
        apiEndpoint: 'https://YOUR_API_GATEWAY_ID.execute-api.us-west-2.amazonaws.com/prod'
    };
    
    const manifestPath = path.join(BUILD_DIR, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    logSuccess(`Created build manifest: ${manifestPath}`);
    
    return manifest;
}

function buildApp(appName, appConfig) {
    logHeader(`Building ${appConfig.name}`);
    
    const outputDir = path.join(BUILD_DIR, appConfig.outputDir);
    ensureDir(outputDir);
    
    // Copy and process files
    for (const file of appConfig.files) {
        if (fs.existsSync(file)) {
            const outputFile = path.join(outputDir, path.basename(file));
            copyFile(file, outputFile);
        } else {
            logWarning(`File not found: ${file}`);
        }
    }
    
    // Copy shared assets
    const sharedAssets = ['favicon.ico', 'robots.txt'];
    for (const asset of sharedAssets) {
        if (fs.existsSync(asset)) {
            const outputFile = path.join(outputDir, asset);
            copyFile(asset, outputFile);
        }
    }
    
    logSuccess(`${appConfig.name} built successfully`);
}

function validateBuild() {
    logHeader('Validating Build');
    
    let isValid = true;
    
    // Check that all apps were built
    for (const [appName, appConfig] of Object.entries(APPS)) {
        const outputDir = path.join(BUILD_DIR, appConfig.outputDir);
        if (!fs.existsSync(outputDir)) {
            logError(`Missing output directory: ${outputDir}`);
            isValid = false;
        } else {
            logSuccess(`${appConfig.name} output directory exists`);
        }
    }
    
    // Check for required files
    const requiredFiles = [
        'player/index.html',
        'dashboard/dashboard.html',
        'streaming/streaming.html',
        'manifest.json'
    ];
    
    for (const file of requiredFiles) {
        const filePath = path.join(BUILD_DIR, file);
        if (!fs.existsSync(filePath)) {
            logError(`Missing required file: ${filePath}`);
            isValid = false;
        } else {
            logSuccess(`Required file exists: ${file}`);
        }
    }
    
    return isValid;
}

function generateDeploymentInstructions(manifest) {
    const instructions = `
# Lunora Player - Deployment Instructions

## Build Information
- Version: ${manifest.version}
- Build Time: ${manifest.buildTime}
- Git Commit: ${manifest.gitCommit}
- Environment: ${manifest.environment}

## Deployment Commands

### Deploy to S3
\`\`\`bash
# Player application
aws s3 sync dist/player/ s3://lunora-player-player-prod-372241484305/ --delete

# Dashboard application  
aws s3 sync dist/dashboard/ s3://lunora-player-dashboard-prod-372241484305/ --delete

# Streaming control application
aws s3 sync dist/streaming/ s3://lunora-player-streaming-prod-372241484305/ --delete
\`\`\`

### Invalidate CloudFront Cache
\`\`\`bash
# Get distribution IDs from CloudFormation outputs
aws cloudfront create-invalidation --distribution-id YOUR_PLAYER_DISTRIBUTION_ID --paths "/*"
aws cloudfront create-invalidation --distribution-id YOUR_DASHBOARD_DISTRIBUTION_ID --paths "/*"
aws cloudfront create-invalidation --distribution-id YOUR_STREAMING_DISTRIBUTION_ID --paths "/*"
\`\`\`

### Update Configuration
After deployment, update the following placeholders in the deployed files:
- YOUR_API_GATEWAY_ID → Actual API Gateway ID
- YOUR_CLOUDFRONT_DOMAIN → Actual CloudFront domain
- YOUR_MEDIAPACKAGE_ENDPOINT → Actual MediaPackage endpoint

## Next Steps
1. Deploy infrastructure: \`./scripts/deploy-production-multi-destination.sh\`
2. Deploy frontend: Use the S3 sync commands above
3. Update configuration with actual AWS resource IDs
4. Test all applications
5. Configure custom domain (optional)
`;
    
    const instructionsPath = path.join(BUILD_DIR, 'DEPLOYMENT.md');
    fs.writeFileSync(instructionsPath, instructions);
    logSuccess(`Created deployment instructions: ${instructionsPath}`);
}

// Main build function
function main() {
    try {
        logHeader('Lunora Player - Production Build');
        
        log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'blue');
        log(`Build directory: ${BUILD_DIR}`, 'blue');
        
        // Clean build directory
        if (fs.existsSync(BUILD_DIR)) {
            fs.rmSync(BUILD_DIR, { recursive: true });
            logSuccess('Cleaned build directory');
        }
        
        ensureDir(BUILD_DIR);
        
        // Build each application
        for (const [appName, appConfig] of Object.entries(APPS)) {
            buildApp(appName, appConfig);
        }
        
        // Create build manifest
        const manifest = createManifest();
        
        // Generate deployment instructions
        generateDeploymentInstructions(manifest);
        
        // Validate build
        if (validateBuild()) {
            logHeader('Build Completed Successfully');
            logSuccess('All applications built and validated');
            log('\nNext steps:', 'blue');
            log('1. Deploy infrastructure: npm run deploy-production', 'blue');
            log('2. Deploy frontend: See dist/DEPLOYMENT.md', 'blue');
            log('3. Update configuration with actual AWS resource IDs', 'blue');
        } else {
            logError('Build validation failed');
            process.exit(1);
        }
        
    } catch (error) {
        logError(`Build failed: ${error.message}`);
        process.exit(1);
    }
}

// Run build
main();
