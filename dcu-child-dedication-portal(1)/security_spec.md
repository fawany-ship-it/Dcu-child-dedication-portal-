# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Unique Non-Colliding Registration IDs**: Every child dedication submission must have an ID matching `^[a-zA-Z0-9_\-]+$` (length 5–64) and must simultaneously create its PII-free `dedication_status/{dedicationId}` projection atomically (`existsAfter`).
2. **Strict Initial Workflow State**: Parent submissions (`create`) on `dedications` and `dedication_status` MUST start with `status == 'submitted'`, `leadershipConfirmed == false`, `officeApproved == false`, and `certificateIssued == false`. Parents cannot pre-approve or issue certificates.
3. **PII Isolation**: Confidential parent contact details (`fatherPhone`, `motherPhone`, `fatherEmail`, `motherEmail`, `residentialLocation`) stored in `dedications` are strictly unreadable by unauthenticated visitors or parents. Login-free tracking queries only `dedication_status`, which stores zero raw phone numbers, emails, or addresses (using SHA-256 `phoneHashes`).
4. **Micro-Church Fellowship Isolation**: Fellowship Leaders can ONLY read, list, and endorse `dedications` whose `selectedZone == leader.assignedZone` and (if `leader.assignedFellowship` is set) `selectedFellowship.lower() == leader.assignedFellowship.lower()`. Fellowship Leaders CANNOT modify `officeApproved`, `certificateIssued`, `past_dedications`, or `staff_roles`.
5. **Verified Staff Identity & Bootstrapped Super Admin**: All privileged operations require `request.auth != null && request.auth.token.email_verified == true`, checked against `staff_roles/{email}` (and bootstrapped `fawany@gmail.com`). Suspended staff (`isSuspended == true`) lose access immediately.
6. **Temporal Integrity**: `createdAt` is immutable and equals `request.time` on creation; `updatedAt` equals `request.time` on create and update.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unverified Email Spoof**: Caller sets `email: "fawany@gmail.com"` with `email_verified: false` to read `dedications`.
2. **PII Scraping (`dedications` list)**: Unauthenticated parent or non-staff user queries `dedications` collection.
3. **Cross-Fellowship Access**: Zone B `Neema` leader tries to `get` or `update` a Zone B `Ebenezer` record (`Anaya Mutheu Ndolo`).
4. **Cross-Zone Access**: Zone A leader tries to read Zone B records.
5. **State Shortcutting on Create**: Parent submits `dedications` with `status: "compiled"`, `officeApproved: true`, `certificateIssued: true`.
6. **Shadow Field Injection on Create**: Parent submits `dedications` with extra field `isAdminBypass: true`.
7. **Leader Privilege Escalation on Update**: Fellowship Leader updates `officeApproved: true` or `certificateIssued: true` instead of only `leadershipConfirmed`, `fellowshipLeaderName`, `fellowshipConfirmedAt`, `fellowshipNotes`, `status`, `updatedAt`.
8. **Self-Promotion in `staff_roles`**: Non-admin user attempts to create or update `staff_roles/{theirEmail}` with `role: "super_admin"`.
9. **Leader Reading Historical Archive**: Fellowship Leader attempts to `get` or `list` `past_dedications`.
10. **ID Poisoning / Buffer Overflow**: Malicious client creates a doc with ID `"../admin/hack"` or a 2KB string in `childName`.
11. **Missing Atomic Status Projection**: Client tries to create `dedications/{id}` without atomically creating `dedication_status/{id}`.
12. **Terminal State Tampering**: Fellowship Leader attempts to revert a `completed` dedication back to `submitted`.
