# Firebase Deployment from GitHub

## Setup Instructions

This project uses GitHub Actions to automatically deploy to Firebase Hosting and update database rules whenever changes are pushed to the main/master branch.

### Step 1: Generate Firebase Token

Run this command locally (requires Firebase CLI installed):

```bash
firebase login:ci
```

This will open a browser for authentication. After completing, you'll get a token like:
```
1//0gXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 2: Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_TOKEN`
5. Value: Paste the token from Step 1
6. Click **Add secret**

### Step 3: Verify Workflow

After adding the secret, any push to `main` or `master` will:
1. Deploy the `public/` folder to Firebase Hosting
2. Deploy database rules from `database.rules.json`

### Manual Deployment

If needed, you can deploy manually:

```bash
# Deploy hosting only
firebase deploy --only hosting

# Deploy database rules only
firebase deploy --only database

# Deploy both
firebase deploy
```

## Security Notes

### Firebase Credentials

**NEVER** commit `firebase_credentials.json` to the repository. This file contains sensitive service account keys.

The `.gitignore` file is configured to exclude:
- `firebase_credentials.json`
- Environment files (`.env`, etc.)
- Any files with sensitive keys

### Database Security Rules

The database rules in `database.rules.json` implement:
- **Public profiles**: Anyone can read
- **Private profiles**: Only owner and shared users can read
- **Write access**: Only authenticated users with permissions
- **Admin access**: Users with role='admin' can access everything

### Setting Up Initial Admin

To make a user an admin (first-time setup):

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (munra-1)
3. Go to **Realtime Database**
4. Find the user's entry under `users/{uid}`
5. Change their `role` from `"user"` to `"admin"`

## Website URLs

- **Production**: https://munra-1.web.app/
- **Database Console**: https://console.firebase.google.com/project/munra-1/database
