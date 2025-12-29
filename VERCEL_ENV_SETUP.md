# Vercel Environment Variables Setup Guide

## Featured Profiles API - Required Environment Variables

The Featured Profiles API requires the following environment variables to be set in Vercel:

### Required Variables

1. **SUPABASE_URL**
   - Your Supabase project URL
   - Format: `https://xxxxx.supabase.co`
   - Where to find: Supabase Dashboard → Settings → API → Project URL

2. **SUPABASE_SERVICE_KEY** (Recommended for RLS)
   - Your Supabase service role key (bypasses RLS)
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Where to find: Supabase Dashboard → Settings → API → Project API keys → `service_role` key
   - ⚠️ **IMPORTANT**: This key has full access - keep it secret!

3. **SUPABASE_ANON_KEY** (Alternative if RLS is disabled)
   - Your Supabase anonymous key
   - Format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Where to find: Supabase Dashboard → Settings → API → Project API keys → `anon` key
   - Note: If RLS is enabled, this will respect RLS policies

## How to Add Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Select your project (basehub-alpha)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Each Variable

For each variable:

1. Click **Add New**
2. Enter the **Key** (e.g., `SUPABASE_URL`)
3. Enter the **Value** (your actual value)
4. Select **Environments**:
   - ✅ Production
   - ✅ Preview
   - ✅ Development (optional)
5. Click **Save**

### Step 3: Redeploy

After adding environment variables:
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. Or push a new commit to trigger automatic redeploy

## Quick Setup Checklist

- [ ] Get `SUPABASE_URL` from Supabase Dashboard
- [ ] Get `SUPABASE_SERVICE_KEY` from Supabase Dashboard (recommended)
- [ ] Add `SUPABASE_URL` to Vercel Environment Variables
- [ ] Add `SUPABASE_SERVICE_KEY` to Vercel Environment Variables
- [ ] Redeploy the application
- [ ] Check Vercel logs to verify variables are loaded

## Verification

After redeploying, check the Vercel function logs. You should see:

```
📋 Supabase Configuration: {
  url: '✅ Set',
  serviceKey: '✅ Set',
  anonKey: '❌ Missing' (or '✅ Set'),
  usingKey: 'SERVICE_KEY'
}
```

If you still see `❌ Missing`, the variables are not set correctly.

## Troubleshooting

### Variables Still Missing After Redeploy

1. **Check variable names**: Must be exactly `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (case-sensitive)
2. **Check environments**: Make sure variables are enabled for Production/Preview
3. **Redeploy**: Environment variables are only loaded on new deployments
4. **Check Vercel logs**: Look for the configuration log message

### RLS Errors

If you get RLS (Row Level Security) errors:
- Use `SUPABASE_SERVICE_KEY` instead of `SUPABASE_ANON_KEY`
- Service key bypasses RLS policies
- Or create proper RLS policies (see `featured-profiles-rls-policies.sql`)

## Security Notes

- ⚠️ **Never commit** `.env` files to Git
- ⚠️ **Never expose** `SUPABASE_SERVICE_KEY` in frontend code
- ✅ Service key should only be used in backend API routes
- ✅ Anon key can be used in frontend (respects RLS)

## Example Values (DO NOT USE THESE - GET YOUR OWN)

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eHh4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTYzODk2ODAwMCwiZXhwIjoxOTU0NTQ0MDAwfQ.xxxxx
```

Get your actual values from your Supabase project!

