# Deliverance Church International (DCI) Utawala
## Child Dedication Registry & Certification Portal — Master System Prompt

Copy and paste the prompt below into any AI coding environment (or keep it as your project specifications document) to reproduce or extend this complete application:

```markdown
Build a comprehensive, modern, and production-ready Child Dedication Registry and Management Portal for "Deliverance Church International (DCI) Utawala" ("The Church of Choice") located in Nairobi, Kenya.

### 1. CHURCH IDENTITY & BRANDING
- Church Name: Deliverance Church International (DCI) Utawala
- Motto: "The Church of Choice • Transforming and Empowering Mankind in Africa and Beyond"
- Senior Pastor: Rev. Emmanuel K.
- Color Palette: Regal navy blue (#1e3a8a / #0f172a), royal gold / amber (#d97706 / #b45309), clean slate, and warm parchment accents.
- Scripture Reference: 1 Samuel 1:27-28 ("I prayed for this child, and the Lord has granted me what I asked of him. So now I give him to the Lord. For his whole life he will be given over to the Lord.")

---

### 2. CORE ARCHITECTURE & USER ROLES
The application must support two distinct experiences:

#### A. Public Parent Experience (100% Accessible Without Login)
Parents must NOT be forced to log in or create passwords to use public church services. The primary navigation must prominently feature:
1. **Home**:
   - Warm welcome banner with church photography and mission.
   - Theological explanation of Child Dedication vs. Infant Baptism (Biblical dedication following the example of Hannah & Samuel, and Jesus presented in the Temple).
   - 4-step walkthrough: Register Online -> Fellowship Leader Endorsement -> Pastoral Preparation -> Dedication Sunday & Certificate Presentation.
   - Next upcoming dedication Sunday countdown.
2. **About DCU**:
   - History and background of DCI Utawala.
   - Vision & Mission statements.
   - Senior Pastor leadership profile: Rev. Emmanuel K.
   - Weekly service schedules (Sunday Celebration Services, Midweek Fellowship, Cell Groups).
   - Church office contacts, physical address in Utawala, Nairobi County, and email.
3. **Register Your Child**:
   - Intuitive, multi-step dedication registration form.
   - Fields collected:
     * Child's Full Legal Name (First, Middle, Surname)
     * Child Gender and Date of Birth
     * County / Hospital of Birth (default: Nairobi County)
     * Father's Full Name, Phone, and Email
     * Mother's Full Name, Phone, and Email
     * Marital / Family Status (Married, Single Parent, Guardian)
     * Home Residence / Estate in Utawala
     * Fellowship / Home Cell Zone (Zone A to Zone E / Estate fellowships)
     * Fellowship Leader Name (if known)
     * Preferred Dedication Sunday Date
     * Special prayer requests or health notes
   - Instant automated generation of a unique Registry Reference ID (e.g., `DCU-DED-2026-042`).
   - Confirmation screen with print/save receipt and immediate instructions for pastoral follow-up.
4. **Track Status**:
   - Public status lookup tool accessible without login.
   - Parents can search by their Reference ID (e.g. `DCU-DED-2026-042`), Child's Full Name, or Parent Phone number.
   - Live visual progress tracker:
     * Step 1: Registration Received & Documented
     * Step 2: Fellowship Leader Verification & Recommendation
     * Step 3: Pastoral Office Review & Scheduling
     * Step 4: Approved & Scheduled for Dedication Sunday
     * Step 5: Dedicated & Certificate Issued

#### B. Church Office & Leadership Portal (Role-Based Access Control)
Secured portal with separate role access:
- **Roles**:
  * `pastor` / `super_admin`: Full administrative control, approvals, certificate generation, past data management, staff invitations.
  * `fellowship_leader`: Can review registrations belonging to their specific Fellowship Zone, add home-visit recommendation notes, and verify parents' church attendance.
- **Office Features**:
  1. **Dashboard & Metrics**: Active registrations, pending fellowship approvals, approved candidates, total certificates issued.
  2. **Active Registrations Queue**: Filter by status, fellowship zone, or date. Review details, approve, request edits, or mark as dedicated.
  3. **Historical Archive ("Past Data List")**:
     - Dedicated repository of historical church dedication records (from 2009 to present).
     - Non-destructive data handling: Preserves exact historical dedication dates (e.g., 2009-11-29), original ministers (e.g. Senior Pastor & Presbytery), and original fellowship zones without auto-overwriting.
     - Search, filter by year/decade, and quick pagination.
  4. **Staff & Leader Directory**:
     - Invite new fellowship leaders with auto-generated tokens and temporary passwords.
     - Login tracking: Show exact `lastLoginAt` timestamps and badges: "Logged On" (with relative and absolute date/time) vs. "Pending First Sign-In".
  5. **Data Export & Backup**:
     - One-click export to CSV / Excel for active records and past archives so the church secretariat can keep offline desktop backups.
  6. **Audit Trail**:
     - Log every approval, status change, and note with timestamp and user ID.

---

### 3. OFFICIAL CERTIFICATE OF CHILD DEDICATION (A5 PRINTABLE)
The certificate must be designed with extreme precision for physical church presentation:
- **Page Size**: **A5 Landscape** (`210mm` width × `148mm` height).
- **Print Optimization**: Strict CSS `@page { size: A5 landscape; margin: 4mm; }` ensuring the browser print dialog prints only the certificate on a single A5 sheet without headers, footers, or page overflow.
- **Certificate Content**:
  - Header: Elegant, prominent title **"Certificate of Child Dedication"** (clean, no branch motto banner above it).
  - Scripture reference: `— 1 Samuel 1:27-28 —`
  - Attestation Text:
    "This certifies that [Child's Full Name] born on [Date of Birth] in [County of Birth], was dedicated to Almighty God at Deliverance Church International Utawala on [Dedication Date]."
  - Parents Line: "Presented by loving parents: [Father's Name] & [Mother's Name]"
  - Signatures & Seals:
    * Left: Official Church Seal / Embossment placeholder ("DCI Utawala Official Church Seal")
    * Center: Registry Reference ID (e.g., `DCU-DED-2009-103`)
    * Right: **Rev. Emmanuel K.**, Senior Pastor
- **Styling**: Regal ornamental gold double borders, watermarked cross/dove motif, traditional serif typography (Cinzel / Playfair / Georgia style), suitable for official framing.

---

### 4. TECHNICAL SPECIFICATIONS & IMPLEMENTATION
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React icons, Canvas-Confetti for celebratory registration completion.
- **Backend / API**:
  * Node.js + Express (`server.ts`) handling REST endpoints:
    - `/api/dedications` (CRUD for active registrations)
    - `/api/past-dedications` (CRUD and search for 2009–present archives)
    - `/api/users` & `/api/invitations` (Staff auth & invitation management)
    - `/api/audit-logs` (Action tracking)
    - `/api/stats` (Summary counts)
  * Serverless support via `api/index.ts` and `vercel.json` for one-click Vercel deployments.
- **Data Persistence**:
  * Persistent JSON registry files stored under `/data/` (`dedications.json`, `past_dedications.json`, `users.json`, `invitations.json`, `audit_logs.json`).
  * Resilient client fallback (`localStorage`) in `src/services/api.ts` to guarantee zero data loss if network connectivity drops.
  * Modular design ready for Google Firebase Firestore or Cloud SQL (PostgreSQL).
- **Navigation & Usability**:
  * Public top navigation: **Home | About DCU | Register Your Child | Track Status**.
  * Discrete button on top right: **Leader / Admin Portal** for authorized church staff login.
```
