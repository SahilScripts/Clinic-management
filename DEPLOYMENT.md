# Deployment Guide for Clinic Management System

## Render Deployment

This application is configured for deployment on Render using the `render.yaml` configuration file.

### Prerequisites

1. **Google Cloud Service Account**: You need a service account with Google Sheets API access
2. **Gmail OAuth2 Credentials**: For sending emails via Gmail API
3. **Render Account**: Sign up at [render.com](https://render.com)

### Step-by-Step Deployment

#### 1. Prepare Your Credentials

**Google Sheets Credentials:**
- Go to Google Cloud Console
- Create a service account with Google Sheets API access
- Download the JSON credentials file
- Copy the entire JSON content (you'll need this as an environment variable)

**Email Credentials:**
- Set up OAuth2 credentials for Gmail API
- Run `node generate-oauth-token.js` locally to get refresh token
- Prepare the credentials in JSON format

#### 2. Deploy to Render

1. **Connect Repository:**
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service:**
   - Render will automatically detect the `render.yaml` file
   - Service name: `clinic-management-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Set Environment Variables:**
   In the Render dashboard, add these environment variables:

   ```
   NODE_ENV=production
   PORT=10000
   SPREADSHEET_ID=your_google_sheets_id_here
   GOOGLE_CREDENTIALS={"type":"service_account","project_id":"..."}
   EMAIL_CREDENTIALS={"oauth2":{"client_id":"...","client_secret":"...","refresh_token":"..."},"from":{"name":"...","email":"..."}}
   ```

   **Optional (for separate diet request email):**
   ```
   DIET_EMAIL_CREDENTIALS={"oauth2":{"client_id":"...","client_secret":"...","refresh_token":"..."},"from":{"name":"Clinic Backoffice","email":"clinic.backoffice@ishafoundation.org"}}
   ```

#### 3. Environment Variables Details

**GOOGLE_CREDENTIALS**: Complete JSON from your service account file
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**EMAIL_CREDENTIALS**: OAuth2 credentials for Gmail
```json
{
  "oauth2": {
    "client_id": "your-client-id.apps.googleusercontent.com",
    "client_secret": "your-client-secret",
    "refresh_token": "your-refresh-token"
  },
  "from": {
    "name": "Your Name",
    "email": "your-email@domain.com"
  }
}
```

#### 4. Verify Deployment

1. **Check Build Logs**: Monitor the deployment process in Render dashboard
2. **Test Health Check**: Visit `https://your-app.onrender.com/api/test`
3. **Test API Endpoints**: Verify Google Sheets integration works

### Local Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Set Up Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your actual credentials
   ```

3. **Run Development Server:**
   ```bash
   npm run dev
   ```

### Troubleshooting

**Common Issues:**

1. **Google Sheets API Errors:**
   - Verify service account has access to the spreadsheet
   - Check SPREADSHEET_ID is correct
   - Ensure Google Sheets API is enabled

2. **Email Sending Errors:**
   - Verify OAuth2 refresh token is valid
   - Check Gmail API is enabled
   - Ensure sender email is authorized

3. **Environment Variable Issues:**
   - JSON strings must be properly escaped
   - No trailing commas in JSON
   - Verify all required variables are set

**Logs:**
- Check Render logs in the dashboard
- Use `console.log` statements for debugging
- Monitor API responses for error details

### Security Notes

- Never commit actual credentials to version control
- Use environment variables for all sensitive data
- Regularly rotate OAuth2 tokens
- Monitor API usage and quotas
