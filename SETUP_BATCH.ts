import { push_files } from '../push_files' // This is just for demonstration

// I'll use push_files to batch create the remaining config files
const files = [
  {
    path: '.eslintrc.cjs',
    content: `module.exports = {
  root: true,
  env: { browser: true, es2020: true, webextensions: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
}
`,
  },
  {
    path: '.prettierrc',
    content: `{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
`,
  },
  {
    path: 'tsconfig.node.json',
    content: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
`,
  },
  {
    path: 'SETUP.md',
    content: `# LinkLeads Setup Guide

## Prerequisites

- Node.js 16+ and npm
- Supabase account (free tier)
- Google Cloud Console project for OAuth
- Chrome browser

## Step 1: Clone and Install

\`\`\`bash
git clone https://github.com/Heyleroy/Linkleads-tool.git
cd Linkleads-tool
npm install
\`\`\`

## Step 2: Supabase Setup

### Create Project
1. Go to https://supabase.com and sign up
2. Create a new project
3. Note your **Project URL** and **Anon Key** from Settings → API

### Create Database Tables

Go to **SQL Editor** and run this:

\`\`\`sql
-- Create profiles table
CREATE TABLE profiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  lookups_used INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'free',
  lookup_reset_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- Create license_keys table
CREATE TABLE license_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'enterprise'))
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can see their own license keys
CREATE POLICY "Users can view their own license keys"
  ON license_keys FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

-- Create indexes
CREATE INDEX profiles_user_id_idx ON profiles(user_id);
CREATE INDEX license_keys_user_id_idx ON license_keys(user_id);
CREATE INDEX license_keys_key_idx ON license_keys(key);
\`\`\`

### Enable Google OAuth

1. Go to **Authentication → Providers** → Enable **Google**
2. Get your Google OAuth credentials:
   - Go to https://console.cloud.google.com
   - Create a new project called "LinkLeads"
   - Enable Google+ API
   - Create OAuth 2.0 credentials (Desktop application)
   - Copy the **Client ID** and **Client Secret**
3. In Supabase, paste these in the Google provider settings

## Step 3: Environment Variables

Create \`.env.local\`:

\`\`\`env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
\`\`\`

## Step 4: Build the Extension

\`\`\`bash
npm run build
\`\`\`

## Step 5: Load in Chrome

1. Open \`chrome://extensions/\`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the \`dist/\` folder
5. **Copy the Extension ID** that appears

## Step 6: Update Google OAuth URIs

In your Google Cloud Console project:

1. Go to **Credentials** → Your OAuth 2.0 client
2. Add Authorized redirect URIs:
   - \`https://{extension-id}.chromiumapp.org/\`
   - \`http://localhost:5173/\` (for dev)

In Supabase:

1. Go to **Authentication → Providers → Google**
2. Add redirect URIs:
   - \`https://{extension-id}.chromiumapp.org/\`

## Step 7: Test Locally

\`\`\`bash
npm run dev
\`\`\`

Visit \`http://localhost:5173\` to test the popup in a browser.

Click the extension icon in Chrome to open the popup and test Google sign-in.

## Troubleshooting

### Extension ID not recognized
- Build first: \`npm run build\`
- Load the unpacked \`dist/\` folder
- Get the ID from \`chrome://extensions/\`

### "Error: Unable to redirect" during OAuth
- Make sure redirect URIs match exactly in both Google Cloud Console and Supabase
- Clear Chrome storage: \`chrome://settings/clearBrowserData\`
- Try again

### Popup doesn't show data after login
- Check browser console for errors (right-click popup → Inspect)
- Verify RLS policies in Supabase are correct
- Check that the profile row was created in Supabase

## Next Steps

- [ ] Implement LinkedIn profile data extraction
- [ ] Add enrichment API integration
- [ ] Set up Stripe payment flow
- [ ] Deploy to Chrome Web Store

---

For issues, check the README.md or open a GitHub issue.
`,
  },
]
