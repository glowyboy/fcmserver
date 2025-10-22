# Football Notification Server

Automatically sends FCM push notifications when matches go live.

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Add Firebase service account:**
   - Copy your Firebase service account JSON file to this folder
   - Rename it to `firebase-service-account.json`

3. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Add your Supabase URL and service role key

4. **Run locally:**
```bash
npm start
```

## Deploy to Railway

1. Go to https://railway.app
2. Sign up/login with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
6. Upload `firebase-service-account.json` as a file
7. Deploy!

The server will run 24/7 and automatically send notifications when matches go live.

## How it works

- Checks every minute for matches that just started
- Sends FCM notification to all users with tokens
- Marks matches as "جارية الآن" (Live Now)
- Auto-updates match status to "انتهت" (Ended) after 2 hours
