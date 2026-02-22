// ============================================
// Supabase Configuration
// ============================================
// 1. Copy this file and rename it to: supabase-config.js
// 2. Replace the values below with your Supabase project credentials
//    (found at: Supabase Dashboard → Settings → API)

const SUPABASE_URL = 'YOUR_SUPABASE_URL';       // e.g., 'https://xxxx.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // e.g., 'eyJhbGciOi...'

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// Auth Functions
// ============================================

async function signInWithGoogle() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    if (error) {
        console.error('Login error:', error.message);
        alert('Login failed: ' + error.message);
    }
}

async function signOutUser() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Logout error:', error.message);
        alert('Logout failed: ' + error.message);
    }
}

async function getCurrentUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

function onAuthStateChange(callback) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        callback(event, session);
    });
}

// ============================================
// Database Functions
// ============================================

async function upsertUserProfile(user) {
    const { error } = await supabaseClient.from('user_profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
        avatar_url: user.user_metadata?.avatar_url || '',
        updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

    if (error) console.error('Profile upsert error:', error);
}

async function loadUserData(userId) {
    const { data, error } = await supabaseClient
        .from('user_data')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Load data error:', error);
    }
    return data;
}

async function saveUserData(userId, dataObj) {
    const { error } = await supabaseClient.from('user_data').upsert({
        user_id: userId,
        timetable: dataObj.timetable || {},
        attendance: dataObj.attendance || {},
        extra_lectures: dataObj.extraLectures || {},
        initial_attendance: dataObj.initialAttendance || {},
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) console.error('Save data error:', error);
}

// Debounced save to avoid spamming Supabase on rapid changes
let saveTimeout = null;
function debouncedSaveUserData(userId, dataObj) {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveUserData(userId, dataObj);
    }, 1000);
}
