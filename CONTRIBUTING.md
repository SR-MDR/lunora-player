# Contributing to Lunora Player

Thank you for your interest in contributing to Lunora Player! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites
- Node.js 18+ 
- AWS CLI configured with appropriate permissions
- Git and GitHub account
- Basic knowledge of JavaScript, HTML5 video, and AWS Media Services

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/lunora-player.git`
3. Install dependencies: `npm install`
4. Configure AWS credentials: `aws configure --profile lunora-media`
5. Start development server: `npm run dev`

## Development Workflow

### Branch Naming
- Feature branches: `feature/description-of-feature`
- Bug fixes: `bugfix/description-of-bug`
- Documentation: `docs/description-of-change`

### Commit Messages
Use clear, descriptive commit messages:
```
feat: add multi-language subtitle support
fix: resolve HLS playback issue on Safari
docs: update AWS setup instructions
```

### Code Style
- Use consistent indentation (2 spaces)
- Follow existing code patterns
- Add comments for complex logic
- Use meaningful variable and function names

## Testing

### Before Submitting
- Test with multiple browsers (Chrome, Firefox, Safari, Edge)
- Verify AWS integration works correctly
- Test with different stream types (live, VOD)
- Check responsive design on mobile devices

### Test Streams
Use the built-in test streams for development:
- Big Buck Bunny (multi-language)
- Sintel (subtitle testing)
- Live stream endpoints (when available)

## Pull Request Process

### Before Creating a PR
1. Ensure your branch is up to date with main
2. Test your changes thoroughly
3. Update documentation if needed
4. Add or update tests if applicable

### PR Description
Include:
- Clear description of changes
- Screenshots/videos for UI changes
- Testing steps performed
- Any breaking changes
- Related issue numbers

### Review Process
- All PRs require review before merging
- Address feedback promptly
- Keep PRs focused and reasonably sized
- Squash commits if requested

## Areas for Contribution

### High Priority
- Browser compatibility improvements
- Performance optimizations
- Accessibility enhancements
- Mobile experience improvements

### Medium Priority
- Additional language support
- UI/UX improvements
- Documentation updates
- Test coverage expansion

### Future Features
- AI-powered translation integration
- Advanced analytics
- User authentication
- DVR functionality

## AWS Development

### Cost Considerations
- Be mindful of AWS costs during development
- Stop MediaLive channels when not in use
- Use development/test environments
- Monitor usage with AWS Cost Explorer

### Infrastructure Changes
- Test CloudFormation templates thoroughly
- Document any new AWS services used
- Consider cost implications
- Update deployment scripts as needed

## Documentation

### What to Document
- New features and configuration options
- API changes
- Setup and deployment procedures
- Troubleshooting guides

### Documentation Style
- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep documentation up to date

## Issue Reporting

### Bug Reports
Include:
- Browser and version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)
- Stream URL (if applicable)

### Feature Requests
Include:
- Clear description of the feature
- Use case and benefits
- Potential implementation approach
- Any related examples

## Community Guidelines

### Be Respectful
- Use inclusive language
- Be patient with new contributors
- Provide constructive feedback
- Help others learn and grow

### Communication
- Use GitHub issues for bug reports and feature requests
- Use pull request comments for code review
- Be clear and specific in communications

## Getting Help

### Resources
- [AWS Media Services Documentation](https://docs.aws.amazon.com/media-services/)
- [HLS.js Documentation](https://github.com/video-dev/hls.js/)
- [HTML5 Video API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)

### Support Channels
- GitHub Issues for bugs and feature requests
- Pull Request comments for code review
- Documentation for setup and usage questions

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes for significant contributions
- README acknowledgments

Thank you for contributing to Lunora Player! 🎥✨
