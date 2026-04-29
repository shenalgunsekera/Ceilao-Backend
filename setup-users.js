// One-time user setup script — run with: node setup-users.js
const API_KEY    = 'AIzaSyAa2MA8GGlGgr1H7bVM0LqfgNeUCWNe81c';
const PROJECT_ID = 'insureme-db';

const USERS = [
  { email: 'manager@ceilao.app',  password: 'Ceilao@2025', role: 'manager',  full_name: 'Ceilao Manager'  },
  { email: 'employee@ceilao.app', password: 'Staff@2025',  role: 'employee', full_name: 'Ceilao Employee' },
];

async function createAuthUser(email, password, displayName) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    }
  );
  return r.json();
}

async function signInUser(email, password) {
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  return r.json();
}

async function writeFirestoreProfile(uid, idToken, data) {
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        fields: {
          role:      { stringValue: data.role },
          full_name: { stringValue: data.full_name },
          email:     { stringValue: data.email },
          is_active: { booleanValue: true },
        },
      }),
    }
  );
  return r.json();
}

async function main() {
  console.log('\n🔧 Ceilao — Firebase user setup\n' + '─'.repeat(40));

  for (const u of USERS) {
    process.stdout.write(`Creating ${u.role} (${u.email})... `);
    const auth = await createAuthUser(u.email, u.password, u.full_name);

    let uid, idToken;
    if (auth.error) {
      if (auth.error.message === 'EMAIL_EXISTS') {
        console.log('already exists — signing in to get token');
        const signin = await signInUser(u.email, u.password);
        if (signin.error) { console.log('  Sign-in FAILED:', signin.error.message); continue; }
        uid = signin.localId; idToken = signin.idToken;
      } else {
        console.log('FAILED:', auth.error.message);
        continue;
      }
    } else {
      console.log('✓ auth created');
      uid = auth.localId; idToken = auth.idToken;
    }

    process.stdout.write(`  Writing Firestore profile... `);
    const profile = await writeFirestoreProfile(uid, idToken, u);

    if (profile.error) {
      console.log('FAILED:', profile.error.message);
      console.log('  → Set Firestore rules to allow writes, then re-run this script.');
    } else {
      console.log('✓ profile saved');
    }
  }

  console.log('\n' + '─'.repeat(40));
  console.log('✅ Done! Your login credentials:\n');
  USERS.forEach(u => {
    console.log(`  Role:     ${u.role}`);
    console.log(`  Email:    ${u.email}`);
    console.log(`  Password: ${u.password}`);
    console.log();
  });
  console.log('─'.repeat(40) + '\n');
}

main().catch(console.error);
