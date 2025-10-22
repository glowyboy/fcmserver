import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Admin with environment variables
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('🚀 Football Notification Server Started');
console.log('⏰ Checking for live matches every minute...');

// Check and send notifications for live matches
async function checkLiveMatches() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    // Get matches that just started (within last 5 minutes) and haven't sent notification
    const { data: matches, error } = await supabase
      .from('matches')
      .select('*')
      .eq('is_active', true)
      .eq('live_notification_sent', false)
      .gte('match_time', fiveMinutesAgo.toISOString())
      .lte('match_time', now.toISOString());

    if (error) {
      console.error('❌ Error fetching matches:', error);
      return;
    }

    if (!matches || matches.length === 0) {
      console.log('✅ No new live matches');
      return;
    }

    console.log(`🔔 Found ${matches.length} new live match(es)!`);

    for (const match of matches) {
      await sendLiveNotification(match);
    }
  } catch (error) {
    console.error('❌ Error in checkLiveMatches:', error);
  }
}

// Send FCM notification for live match
async function sendLiveNotification(match) {
  try {
    console.log(`📺 Sending notification for: ${match.opponent1_name} VS ${match.opponent2_name}`);

    // Get all FCM tokens from users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('fcm_token')
      .not('fcm_token', 'is', null);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    const tokens = users.map(u => u.fcm_token).filter(Boolean);

    if (tokens.length === 0) {
      console.log('⚠️  No FCM tokens found');
      return;
    }

    // Send FCM notification
    const message = {
      notification: {
        title: '⚽ المباراة بدأت!',
        body: `${match.opponent1_name} VS ${match.opponent2_name} - مباشر الآن`
      },
      data: {
        matchId: match.id.toString(),
        type: 'live',
        url: match.live_url
      },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ Sent to ${response.successCount}/${tokens.length} devices`);

    // Mark notification as sent
    await supabase
      .from('matches')
      .update({ 
        live_notification_sent: true,
        status: 'جارية الآن'
      })
      .eq('id', match.id);

    // Log notification
    await supabase.from('notifications_log').insert({
      title: message.notification.title,
      message: message.notification.body,
      status: 'sent',
      recipients_count: response.successCount,
      notification_type: 'live'
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

// Check for matches ending (auto-update status)
async function updateMatchStatuses() {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // Mark matches as ended if they started more than 2 hours ago
    const { error } = await supabase
      .from('matches')
      .update({ status: 'انتهت' })
      .eq('is_active', true)
      .neq('status', 'انتهت')
      .lt('match_time', twoHoursAgo.toISOString());

    if (error) {
      console.error('❌ Error updating match statuses:', error);
    }
  } catch (error) {
    console.error('❌ Error in updateMatchStatuses:', error);
  }
}

// Run checks every minute
setInterval(async () => {
  console.log(`\n⏰ ${new Date().toLocaleTimeString()} - Checking...`);
  await checkLiveMatches();
  await updateMatchStatuses();
}, 60 * 1000);

// Run immediately on start
checkLiveMatches();
updateMatchStatuses();

// Keep server alive
process.on('SIGTERM', () => {
  console.log('👋 Server shutting down...');
  process.exit(0);
});
