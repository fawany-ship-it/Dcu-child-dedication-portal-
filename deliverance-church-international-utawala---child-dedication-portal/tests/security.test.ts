import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✓ PASS: ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err) });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.message || err}`);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(url: string, maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${url}/api/auth/verify-invitation?token=ping`);
      // Any response from express means server is listening
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function main() {
  console.log('\n======================================================');
  console.log(' DCU CHILD DEDICATION PORTAL - AUTOMATED SECURITY AUDIT');
  console.log('======================================================\n');

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    console.error(`ERROR: Server at ${BASE_URL} is not responding.`);
    process.exit(1);
  }

  console.log(`Connected to target server at ${BASE_URL}\n`);

  // Helper variables across tests
  let superAdminToken = '';
  let superAdminUser: any = null;
  let fellowshipLeaderToken = '';
  let parentToken = '';
  let parentEmail = `test.parent.${Date.now()}@example.com`;
  let parentChildId = '';

  // ------------------------------------------------------------------------
  // TEST 1: Visitor Cannot Register as Admin or Pastor
  // ------------------------------------------------------------------------
  await runTest('TEST 1: Visitor cannot register as Admin or Pastor (Public registration rejects privileged roles)', async () => {
    // Attempt registering as admin
    const resAdmin = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker.admin.${Date.now()}@gmail.com`,
        password: 'password123',
        name: 'Attacker Admin',
        role: 'admin'
      })
    });

    if (resAdmin.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for admin registration attempt, got ${resAdmin.status}`);
    }

    // Attempt registering as pastor
    const resPastor = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `hacker.pastor.${Date.now()}@gmail.com`,
        password: 'password123',
        name: 'Attacker Pastor',
        role: 'pastor'
      })
    });

    if (resPastor.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for pastor registration attempt, got ${resPastor.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 2: Newly created Google account cannot gain privileged access
  // ------------------------------------------------------------------------
  await runTest('TEST 2: Newly created Google account cannot gain privileged access (Defaults strictly to parent role)', async () => {
    const randomGoogleEmail = `unauthorized.google.${Date.now()}@gmail.com`;
    const res = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomGoogleEmail,
        name: 'New Google User'
      })
    });

    if (!res.ok) {
      throw new Error(`Google login request failed: ${res.status}`);
    }

    const data = await res.json();
    if (data.user.role !== 'parent') {
      throw new Error(`Expected newly created Google account to receive 'parent' role, but got '${data.user.role}'`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 3: Authenticate existing authorized Super Admin via bootstrap/login
  // ------------------------------------------------------------------------
  await runTest('TEST 3: Approved Super Admin account receives only its authorized role', async () => {
    // Authenticate using bootstrap token or default admin credentials
    const adminEmail = 'fawany@gmail.com';
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminEmail,
        password: 'DcuAdmin2026!#'
      })
    });

    if (!loginRes.ok) {
      // If password changed or uninitialized, bootstrap
      const bRes = await fetch(`${BASE_URL}/api/security/bootstrap-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrapSecret: 'DCU-ADMIN-BOOTSTRAP-2026-SECURE',
          email: adminEmail,
          password: 'DcuAdmin2026!#',
          name: 'Fawany (Administrator)'
        })
      });
      if (!bRes.ok) throw new Error(`Could not authenticate Super Admin: ${loginRes.status}`);
      const bData = await bRes.json();
      superAdminToken = bData.token;
      superAdminUser = bData.user;
    } else {
      const loginData = await loginRes.json();
      superAdminToken = loginData.token;
      superAdminUser = loginData.user;
    }

    if (superAdminUser.role !== 'super_admin' && superAdminUser.role !== 'admin') {
      throw new Error(`Expected authorized role 'super_admin', got '${superAdminUser.role}'`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 4: Unauthenticated API Requests Cannot Retrieve Confidential Records
  // ------------------------------------------------------------------------
  await runTest('TEST 4: Unauthenticated API requests cannot retrieve confidential records (401 Unauthorized)', async () => {
    // 1. Dedications list
    const resDedications = await fetch(`${BASE_URL}/api/dedications`);
    if (resDedications.status !== 401) {
      throw new Error(`GET /api/dedications should require auth (401), got ${resDedications.status}`);
    }

    // 2. Past dedications list
    const resPast = await fetch(`${BASE_URL}/api/past-dedications`);
    if (resPast.status !== 401) {
      throw new Error(`GET /api/past-dedications should require auth (401), got ${resPast.status}`);
    }

    // 3. Users list
    const resUsers = await fetch(`${BASE_URL}/api/users`);
    if (resUsers.status !== 401) {
      throw new Error(`GET /api/users should require auth (401), got ${resUsers.status}`);
    }

    // 4. Audit logs
    const resAudit = await fetch(`${BASE_URL}/api/audit-logs`);
    if (resAudit.status !== 401) {
      throw new Error(`GET /api/audit-logs should require auth (401), got ${resAudit.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 5: Parents Cannot Access Other Families' Information
  // ------------------------------------------------------------------------
  await runTest('TEST 5: Parents cannot access other families\' information (Strict data isolation)', async () => {
    // 1. Register a legitimate parent
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: parentEmail,
        password: 'ParentPassword2026!',
        name: 'Faith Mwende',
        phone: '0711 222 333'
      })
    });
    if (!regRes.ok) throw new Error(`Parent registration failed: ${regRes.status}`);
    const regData = await regRes.json();
    parentToken = regData.token;

    // 2. Submit a dedication for this parent
    const childRes = await fetch(`${BASE_URL}/api/dedications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${parentToken}`
      },
      body: JSON.stringify({
        childName: 'Baby Jessica Mutua',
        childDob: '2026-02-14',
        childGender: 'Female',
        childCountyOfBirth: 'Nairobi',
        fatherName: 'Daniel Mutua',
        fatherPhone: '0711 222 333',
        parentEmail: parentEmail,
        dataConsent: true,
        selectedZone: 'Zone A',
        selectedFellowship: 'Doxa'
      })
    });
    if (!childRes.ok) throw new Error(`Child submission failed: ${childRes.status}`);
    const childData = await childRes.json();
    parentChildId = childData.id;

    // 3. Parent queries /api/dedications
    const listRes = await fetch(`${BASE_URL}/api/dedications`, {
      headers: { 'Authorization': `Bearer ${parentToken}` }
    });
    if (!listRes.ok) throw new Error(`Parent query failed: ${listRes.status}`);
    const listData = await listRes.json();

    // Verify list contains ONLY their own child and does NOT contain other families
    if (!Array.isArray(listData) || listData.length === 0) {
      throw new Error(`Parent should see their own submitted child record`);
    }

    const nonOwnerRecord = listData.find((d: any) => 
      d.submittedBy !== parentEmail && 
      d.parentEmail !== parentEmail && 
      d.fatherEmail !== parentEmail && 
      d.motherEmail !== parentEmail
    );

    if (nonOwnerRecord) {
      throw new Error(`Data leak: Parent can see other family's record ID: ${nonOwnerRecord.id} (${nonOwnerRecord.childName})`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 6: Fellowship Leaders & Pastors Cannot Access Records Beyond Assigned Permissions
  // ------------------------------------------------------------------------
  await runTest('TEST 6: Fellowship Leaders cannot view or modify records outside their assigned zone', async () => {
    // Login as Zone A Leader
    const leaderRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'zoneA.leader@dcutawala.org',
        password: 'DcuLeader2026!#'
      })
    });
    if (!leaderRes.ok) throw new Error(`Zone A Leader login failed: ${leaderRes.status}`);
    const leaderData = await leaderRes.json();
    fellowshipLeaderToken = leaderData.token;

    // Leader queries dedications
    const dedicationsRes = await fetch(`${BASE_URL}/api/dedications`, {
      headers: { 'Authorization': `Bearer ${fellowshipLeaderToken}` }
    });
    if (!dedicationsRes.ok) throw new Error(`Query failed: ${dedicationsRes.status}`);
    const dedicationsList = await dedicationsRes.json();

    // Verify all returned records are strictly Zone A
    const nonZoneARecord = dedicationsList.find((d: any) => d.selectedZone !== 'Zone A');
    if (nonZoneARecord) {
      throw new Error(`Zone privacy leak: Zone A leader received record ${nonZoneARecord.id} in ${nonZoneARecord.selectedZone}`);
    }

    // Try modifying a Zone B record directly
    const superListRes = await fetch(`${BASE_URL}/api/dedications`, {
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    const superList = await superListRes.json();
    const zoneBRecord = superList.find((d: any) => d.selectedZone === 'Zone B');

    if (zoneBRecord) {
      const tamperRes = await fetch(`${BASE_URL}/api/dedications/${zoneBRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fellowshipLeaderToken}`
        },
        body: JSON.stringify({
          leadershipConfirmed: true,
          fellowshipNotes: 'Unauthorized cross-zone endorsement attempt'
        })
      });

      if (tamperRes.status !== 403) {
        throw new Error(`Expected HTTP 403 Forbidden for cross-zone modification, got ${tamperRes.status}`);
      }
    }
  });

  // ------------------------------------------------------------------------
  // TEST 7: Non-Super-Admins Cannot Promote Themselves or Access Audit Logs
  // ------------------------------------------------------------------------
  await runTest('TEST 7: Non-Super-Admins cannot promote themselves or invite staff (RBAC enforced)', async () => {
    // Fellowship Leader attempts to access audit logs
    const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
      headers: { 'Authorization': `Bearer ${fellowshipLeaderToken}` }
    });
    if (auditRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for non-admin audit log query, got ${auditRes.status}`);
    }

    // Fellowship Leader attempts to issue staff invitation
    const inviteRes = await fetch(`${BASE_URL}/api/users/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fellowshipLeaderToken}`
      },
      body: JSON.stringify({
        email: 'attacker@evil.com',
        role: 'super_admin'
      })
    });
    if (inviteRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden for non-admin staff invitation, got ${inviteRes.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 8: Public Registration Cannot Modify Existing Records or Inject Staff Flags
  // ------------------------------------------------------------------------
  await runTest('TEST 8: Public registration sanitizes administrative approval flags', async () => {
    const injectRes = await fetch(`${BASE_URL}/api/dedications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName: 'Tamper Test Child',
        childDob: '2026-01-01',
        dataConsent: true,
        // Injected administrative bypass fields
        officeApproved: true,
        leadershipConfirmed: true,
        certificateIssued: true,
        certificateNumber: 'DCU-FORGED-999',
        status: 'completed'
      })
    });

    if (!injectRes.ok) throw new Error(`Submission failed: ${injectRes.status}`);
    const injected = await injectRes.json();

    if (injected.officeApproved !== false || injected.leadershipConfirmed !== false || injected.certificateIssued !== false) {
      throw new Error(`Security failure: Server accepted client-injected approval flags on public submission!`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 9: Revoked Invitations Cannot Be Reused
  // ------------------------------------------------------------------------
  await runTest('TEST 9: Revoked invitations cannot be reused or accepted', async () => {
    const inviteEmail = `invited.pastor.${Date.now()}@example.com`;

    // 1. Super Admin issues invitation
    const createRes = await fetch(`${BASE_URL}/api/users/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        email: inviteEmail,
        name: 'Pastor Candidate',
        role: 'pastor'
      })
    });
    if (!createRes.ok) throw new Error(`Failed to issue invitation: ${createRes.status}`);
    const inviteData = await createRes.json();
    const token = inviteData.rawToken;
    const invId = inviteData.invitation.id;

    // 2. Super Admin revokes invitation
    const revokeRes = await fetch(`${BASE_URL}/api/invitations/${invId}/revoke`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${superAdminToken}` }
    });
    if (!revokeRes.ok) throw new Error(`Failed to revoke invitation: ${revokeRes.status}`);

    // 3. Attacker attempts to accept revoked invitation
    const acceptRes = await fetch(`${BASE_URL}/api/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        email: inviteEmail,
        password: 'NewPastorPassword2026!',
        name: 'Pastor Candidate'
      })
    });

    if (acceptRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for revoked invitation acceptance, got ${acceptRes.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // TEST 10: Suspended Accounts Lose Access Immediately
  // ------------------------------------------------------------------------
  await runTest('TEST 10: Suspended accounts lose access immediately across active sessions', async () => {
    // 1. Create a staff user via invitation
    const testStaffEmail = `staff.to.suspend.${Date.now()}@example.com`;
    const createRes = await fetch(`${BASE_URL}/api/users/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({
        email: testStaffEmail,
        name: 'Staff To Suspend',
        role: 'fellowship_leader',
        assignedZone: 'Zone C'
      })
    });
    const invData = await createRes.json();

    // Accept invitation to establish active session
    const acceptRes = await fetch(`${BASE_URL}/api/auth/accept-invitation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: invData.rawToken,
        email: testStaffEmail,
        password: 'Password12345!',
        name: 'Staff To Suspend'
      })
    });
    const sessionData = await acceptRes.json();
    const staffToken = sessionData.token;
    const staffId = sessionData.user.id;

    // Verify staff token currently works
    const testMeBefore = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    if (!testMeBefore.ok) throw new Error(`Staff should be authorized initially`);

    // 2. Super Admin suspends the user
    const suspendRes = await fetch(`${BASE_URL}/api/users/${staffId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${superAdminToken}`
      },
      body: JSON.stringify({ isSuspended: true })
    });
    if (!suspendRes.ok) throw new Error(`Failed to suspend user: ${suspendRes.status}`);

    // 3. User's active session token should now be rejected immediately!
    const testMeAfter = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    if (testMeAfter.status !== 401 && testMeAfter.status !== 403) {
      throw new Error(`Expected HTTP 401 or 403 after account suspension, got ${testMeAfter.status}`);
    }

    // 4. Login attempt with valid password should also be rejected
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testStaffEmail,
        password: 'Password12345!'
      })
    });
    if (reLoginRes.status !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden on login for suspended account, got ${reLoginRes.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n======================================================');
  console.log(' SECURITY TEST SUITE RESULTS SUMMARY');
  console.log('======================================================');

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log(`Total Tests Run: ${results.length}`);
  console.log(`Passed:          ${passedCount}`);
  console.log(`Failed:          ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.error(`- ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\nALL 10 MANDATORY SECURITY TESTS PASSED SUCCESSFULLY! ✓\n');
  }
}

main().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
