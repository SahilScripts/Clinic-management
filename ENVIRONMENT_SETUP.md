# Environment Setup Guide

This guide explains how to set up the environment variables required for the Clinic Management System.

## ⚠️ Security Notice

**NEVER commit actual credentials to version control!** All sensitive data has been removed from this repository and must be configured locally.

## Quick Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and replace all placeholder values with your actual credentials.

## Required Environment Variables

### Server Configuration
- `NODE_ENV`: Set to `development` for local development, `production` for deployment
- `PORT`: Port number for the server (default: 10000)

### Google Sheets Integration
- `SPREADSHEET_ID`: Your Google Sheets spreadsheet ID
- `GOOGLE_CREDENTIALS`: JSON string containing Google Service Account credentials

### Gemini AI Integration
- `API`: Your Google Gemini API key (also accepts `GEMINI_API_KEY`)

### Email Configuration
- `EMAIL_CREDENTIALS`: JSON string containing OAuth2 credentials for main email
- `DIET_EMAIL_CREDENTIALS`: JSON string containing OAuth2 credentials for diet request emails (optional)

### Authentication
- `AUTH_USERNAME`: Admin username for system access
- `AUTH_PASSWORD`: Admin password for system access

## Detailed Setup Instructions

### 1. Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Download the JSON key file
5. Share your Google Sheet with the service account email
6. Copy the JSON content to `GOOGLE_CREDENTIALS` in your `.env` file

### 2. Gemini AI Setup

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add the key to `API` in your `.env` file

### 3. Email Setup (OAuth2)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Gmail API
3. Create OAuth2 credentials:
   - Go to APIs & Credentials > Credentials
   - Create OAuth2 Client ID
   - Add authorized redirect URIs
4. Use OAuth2 playground to get refresh token
5. Format credentials as JSON and add to `EMAIL_CREDENTIALS`

### 4. Authentication Setup

Set secure username and password in your `.env` file:
```
AUTH_USERNAME=your_secure_username
AUTH_PASSWORD=your_secure_password
```

## Production Deployment

For production deployment on platforms like Render, Heroku, etc.:

1. Set all environment variables in your hosting platform's dashboard
2. Do NOT include the `.env` file in your deployment
3. Use secure, randomly generated passwords
4. Consider using more robust authentication methods

## File Structure

```
├── .env                    # Your local environment variables (DO NOT COMMIT)
├── .env.example           # Template for environment variables
├── .gitignore             # Prevents sensitive files from being committed
└── ENVIRONMENT_SETUP.md   # This file
```

## Troubleshooting

### Common Issues

1. **"API key not found" error**: Ensure `API` is set in your `.env` file
2. **Google Sheets access denied**: Verify service account has access to your sheet
3. **Email sending fails**: Check OAuth2 credentials and refresh token validity
4. **Authentication fails**: Verify `AUTH_USERNAME` and `AUTH_PASSWORD` are set

### Verification

To verify your setup is working:

1. Start the server: `npm start`
2. Check console for any credential-related errors
3. Test login with your configured credentials
4. Test Google Sheets integration
5. Test email functionality

## Security Best Practices

1. Use strong, unique passwords
2. Regularly rotate API keys and tokens
3. Use environment-specific credentials
4. Monitor access logs
5. Keep dependencies updated
6. Use HTTPS in production

## Support

If you encounter issues with environment setup, check:
1. All placeholder values are replaced with actual credentials
2. JSON strings are properly formatted
3. Service accounts have necessary permissions
4. API keys are valid and not expired
