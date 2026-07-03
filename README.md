# LinkLeads - LinkedIn Profile Enrichment Chrome Extension

A freemium Chrome extension that enriches LinkedIn profiles with additional data. Built with React, Supabase, and Stripe for monetization.

## Features

- 🔐 **Google OAuth Authentication** - No passwords, just Google sign-in
- 📊 **Free Tier** - 10 lookups per month included
- 💳 **Premium Plans** - Upgrade via Stripe for more lookups
- 🔗 **LinkedIn Integration** - One-click enrichment on LinkedIn profiles
- 📱 **Chrome Extension** - Manifest V3 with React popup UI

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Payments**: Stripe Checkout
- **Extension**: Chrome Manifest V3
- **Build**: Vite Plugin Web Extension

## Project Structure

```
src/
├── popup/              # React popup UI
│   ├── App.tsx        # Main component with auth flow
│   ├── popup.tsx      # React entry point
│   ├── index.html     # Popup HTML
│   └── popup.css      # Popup styles
├── background/         # Service worker for MV3
│   └── service-worker.ts
├── content/           # Content script for LinkedIn pages
│   └── content-script.ts
├── lib/               # Utility libraries
│   └── supabase.ts    # Supabase client configuration
├── assets/            # Extension icons
└── manifest.json      # Chrome Extension manifest
```

## Prerequisites

- Node.js 16+ and npm
- Supabase account (free tier works)
- Google Cloud Console project for OAuth
- Stripe account for payments (optional for MVP)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/Heyleroy/Linkleads-tool.git
cd Linkleads-tool
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your **Project URL** and **Anon Key** from Settings → API

### 3. Create Database Tables

In your Supabase project, go to **SQL Editor** and run:

```sql
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

-- Create indexes for performance
CREATE INDEX profiles_user_id_idx ON profiles(user_id);
CREATE INDEX license_keys_user_id_idx ON license_keys(user_id);
CREATE INDEX license_keys_key_idx ON license_keys(key);
```

### 4. Configure Google OAuth in Supabase

1. Go to **Authentication → Providers** in Supabase
2. Enable **Google**
3. Add your credentials from Google Cloud Console
4. Add redirect URIs (will need extension ID after first build):
   ```
   https://{your-extension-id}.chromiumapp.org/
   http://localhost:5173
   ```

### 5. Set Environment Variables

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Build the Extension

```bash
npm run build
```

This generates a `dist/` folder with the built extension.

### 7. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Your extension ID will appear - use it to update Google OAuth URIs

### 8. Test Locally (Development)

```bash
npm run dev
```

This starts a dev server at `http://localhost:5173` with hot reload for testing the popup in a browser before extension packing.

## Usage

1. Click the LinkLeads icon in your Chrome toolbar
2. Click "Sign in with Google"
3. Authorize the extension with your Google account
4. You'll see your profile and "10 free lookups left" badge
5. Navigate to any LinkedIn profile and use the enrichment feature

## Database Schema

### Profiles Table

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID (PK) | Supabase auth user ID |
| `email` | TEXT | User email |
| `lookups_used` | INTEGER | Lookups used this month |
| `plan` | TEXT | 'free', 'pro', or 'enterprise' |
| `lookup_reset_date` | TIMESTAMP | When monthly limit resets |
| `created_at` | TIMESTAMP | Account creation date |
| `updated_at` | TIMESTAMP | Last update timestamp |

### License Keys Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | License key ID |
| `key` | TEXT (UNIQUE) | License key string |
| `plan` | TEXT | Plan type for this key |
| `status` | TEXT | 'active', 'inactive', 'expired' |
| `user_id` | UUID (FK) | Associated user (null = unused) |
| `created_at` | TIMESTAMP | When key was created |
| `expires_at` | TIMESTAMP | Expiration date |

## Authentication Flow

1. User clicks "Sign in with Google"
2. Supabase opens Google OAuth popup
3. After success, Supabase returns session with user info
4. Session stored in Chrome storage (encrypted)
5. Profile fetched and displayed in popup
6. First-time users get a free tier profile created

## Next Steps

- [ ] Implement LinkedIn profile data extraction
- [ ] Add lookup API integration
- [ ] Implement Stripe payment flow
- [ ] Add profile enrichment data display
- [ ] Create settings/preferences page
- [ ] Set up analytics
- [ ] Deploy to Chrome Web Store

## Environment Variables

```env
VITE_SUPABASE_URL          # Your Supabase project URL
VITE_SUPABASE_ANON_KEY     # Your Supabase anonymous key
```

## Troubleshooting

### "Extension ID not recognized"
- Build the extension first: `npm run build`
- Load it in Chrome to get the ID
- Update Google OAuth redirect URIs in Supabase

### "Error: Unable to redirect"
- Make sure the redirect URI in Supabase matches your extension ID exactly
- Clear Chrome storage and try again

### "No profile found after login"
- Check your Supabase RLS policies
- Ensure the user row was created in the profiles table
- Check browser console for errors

## Contributing

Contributions are welcome! Please:

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check existing discussions
- Read the docs carefully

## Roadmap

### Phase 1 (MVP - Current)
- ✅ Google OAuth
- ✅ Free tier tracking
- ⏳ LinkedIn data extraction

### Phase 2
- Stripe integration
- Premium tiers
- Lookup history

### Phase 3
- Chrome Web Store listing
- Mobile companion app
- Advanced analytics

---

**Built with ❤️ by LinkLeads Team**
