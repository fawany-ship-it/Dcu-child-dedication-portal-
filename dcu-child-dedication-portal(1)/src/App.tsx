/**
 * Deliverance Church International Utawala - The Church of Choice
 */
import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { About } from './components/About';
import { Home } from './components/Home';
import { ParentForm } from './components/ParentForm';
import { LeadershipPortal } from './components/LeadershipPortal';
import { OfficeCompile } from './components/OfficeCompile';
import { StatusTracker } from './components/StatusTracker';
import { DataLists } from './components/DataLists';
import { PastDataList } from './components/PastDataList';
import { AccessDeniedGate } from './components/AccessDeniedGate';
import { CertificateModal } from './components/CertificateModal';
import { AuthModal } from './components/AuthModal';
import { ChurchLogo } from './components/ChurchLogo';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DedicationRecord, PastDedicationRecord } from './types';
import { api } from './services/api';
import { Phone, Mail, MapPin, Shield, Download } from 'lucide-react';

function MainApp() {
  const { 
    user, 
    isSuperAdmin, 
    isOfficeAdmin, 
    isPastor, 
    isFellowshipLeader, 
    isPastorOrLeader, 
    isStaff, 
    openAuthModal 
  } = useAuth();

  // Tabs order:
  // 1. Home
  // 2. About DCU
  // 3. Register your child
  // 4. Track status
  // 5. Leadership
  // 6. Office Compile
  // 7. Data lists
  // 8. Past data list
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [dedications, setDedications] = useState<DedicationRecord[]>([]);
  const [pastDedications, setPastDedications] = useState<PastDedicationRecord[]>([]);
  const [selectedCertificate, setSelectedCertificate] = useState<DedicationRecord | null>(null);
  const [trackerQuery, setTrackerQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load live dedications and isolated past dedications archive
  useEffect(() => {
    async function loadData() {
      try {
        const [active, past] = await Promise.all([
          api.getDedications(),
          api.getPastDedications()
        ]);
        setDedications(active);
        setPastDedications(past);
      } catch (e) {
        console.error('Failed to load portal data', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleCreateDedication = (newRecord: DedicationRecord) => {
    setDedications((prev) => [newRecord, ...prev]);
  };

  const handleUpdateDedication = async (id: string, updates: Partial<DedicationRecord>) => {
    try {
      const updated = await api.updateDedication(id, updates);
      setDedications((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e) {
      console.error('Update failed', e);
    }
  };

  const handleDeleteDedication = async (id: string) => {
    try {
      await api.deleteDedication(id);
      setDedications((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleBulkImport = async (records: any[]) => {
    try {
      await api.bulkImport(records);
      const fresh = await api.getDedications();
      setDedications(fresh);
    } catch (e) {
      console.error('Bulk import failed', e);
    }
  };

  // Past Historical Dedications Handlers (Completely isolated from active pipeline)
  const handleAddPastDedication = async (newRec: Partial<PastDedicationRecord>) => {
    try {
      const created = await api.createPastDedication(newRec);
      setPastDedications((prev) => [created, ...prev]);
    } catch (e) {
      console.error('Failed to add past record', e);
    }
  };

  const handleBulkImportPast = async (records: any[], options?: { replaceYear?: number; replaceAll?: boolean }) => {
    try {
      await api.bulkImportPastDedications(records, options);
      const fresh = await api.getPastDedications();
      setPastDedications(fresh);
    } catch (e) {
      console.error('Failed to bulk import past records', e);
      throw e;
    }
  };

  const handleUpdatePastDedication = async (id: string, updates: Partial<PastDedicationRecord>) => {
    try {
      const updated = await api.updatePastDedication(id, updates);
      setPastDedications((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (e) {
      console.error('Failed to update past record', e);
    }
  };

  const handleDeletePastDedication = async (id: string) => {
    try {
      await api.deletePastDedication(id);
      setPastDedications((prev) => prev.filter((d) => d.id !== id));
    } catch (e) {
      console.error('Failed to delete past record', e);
    }
  };

  // Counters for tabs
  const pendingLeadershipCount = dedications.filter((d) => !d.leadershipConfirmed).length;
  const pendingOfficeCount = dedications.filter((d) => d.leadershipConfirmed && !d.officeApproved).length;

  // Check user authorization levels
  const isStaffAuthenticated = isStaff;
  const isOfficeAdminAuthorized = isOfficeAdmin || isPastor;

  // Automatically switch tab when administrative staff sign in
  useEffect(() => {
    if (user) {
      const normalizedRole = user.role === 'admin' ? 'super_admin' : user.role;
      if (normalizedRole === 'super_admin' || normalizedRole === 'office_admin' || normalizedRole === 'pastor') {
        if (currentTab === 'about' || currentTab === 'home') {
          setCurrentTab('office_compile');
        }
      } else if (normalizedRole === 'fellowship_leader') {
        if (currentTab === 'about' || currentTab === 'home') {
          setCurrentTab('leadership');
        }
      }
    }
  }, [user]);

  const navigateToTrackerWithId = (refName: string) => {
    setTrackerQuery(refName);
    setCurrentTab('track');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfbf7] text-gray-900 selection:bg-[#d4af37]/30 selection:text-[#2a170e]">
      {/* Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => setCurrentTab(tab)}
        pendingLeadershipCount={pendingLeadershipCount}
        pendingOfficeCount={pendingOfficeCount}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Tab 1: Home */}
        {currentTab === 'home' && (
          <Home
            onNavigate={(tab) => setCurrentTab(tab)}
            totalRecordsCount={dedications.length + pastDedications.length}
          />
        )}

        {/* Tab 2: About DCU */}
        {currentTab === 'about' && <About onNavigate={(tab) => setCurrentTab(tab)} />}

        {/* Tab 3: Register your child */}
        {currentTab === 'register' && (
          <ParentForm
            onSubmitSuccess={handleCreateDedication}
            onNavigateToTracker={navigateToTrackerWithId}
          />
        )}

        {/* Tab 4: Track status (Parents) */}
        {currentTab === 'track' && (
          <StatusTracker
            dedications={dedications}
            initialSearchQuery={trackerQuery}
            onOpenCertificate={(record) => setSelectedCertificate(record)}
          />
        )}

        {/* Tab 5: Leadership (Fellowship leaders confirm sent forms) */}
        {currentTab === 'leadership' && (
          isStaffAuthenticated ? (
            <LeadershipPortal
              dedications={dedications}
              onUpdateDedication={handleUpdateDedication}
            />
          ) : (
            <AccessDeniedGate
              tabTitle="Fellowship Leadership Portal"
              tabDescription="Home Fellowship Leaders must sign in to review and confirm child dedication forms sent by parents for their respective fellowship zones (Zones A to E)."
            />
          )
        )}

        {/* Tab 6: Office Compile (Church admins confirm & compile) */}
        {currentTab === 'office_compile' && (
          isOfficeAdminAuthorized ? (
            <OfficeCompile
              dedications={dedications}
              onUpdateDedication={handleUpdateDedication}
              onOpenCertificate={(record) => setSelectedCertificate(record)}
            />
          ) : (
            <AccessDeniedGate
              tabTitle={user?.role === 'fellowship_leader' ? 'Church Office Administration Only' : 'Church Office Compile & Verification'}
              tabDescription={
                user?.role === 'fellowship_leader'
                  ? 'Fellowship Zone Leaders do not have access to Church Office Administration. Your task is completed once you confirm forms in the Leadership Portal for your zone. The Church Office verifies and compiles the candidate lists.'
                  : 'Church Office Administrators must sign in to verify fellowship approvals and compile official candidate lists for the Dedication Sunday.'
              }
            />
          )
        )}

        {/* Tab 7: Data lists (Active candidate lists) */}
        {currentTab === 'data_lists' && (
          isOfficeAdminAuthorized ? (
            <DataLists
              dedications={dedications}
              onUpdateDedication={handleUpdateDedication}
              onDeleteDedication={handleDeleteDedication}
              onBulkImport={handleBulkImport}
              onOpenCertificate={(record) => setSelectedCertificate(record)}
            />
          ) : (
            <AccessDeniedGate
              tabTitle={user?.role === 'fellowship_leader' ? 'Church Office Data Lists' : 'Active Data Lists Register'}
              tabDescription={
                user?.role === 'fellowship_leader'
                  ? 'Active candidate data registers and Excel exports are restricted to Church Office Administrators. Fellowship leaders review member forms in the Leadership Portal.'
                  : 'Authorized church administrators must sign in with Google to view active registration registers and export data.'
              }
            />
          )
        )}

        {/* Tab 8: Past data list (Archived dedicated children since 2009) */}
        {currentTab === 'past_data' && (
          isOfficeAdminAuthorized ? (
            <PastDataList
              pastDedications={pastDedications}
              onAddPastDedication={handleAddPastDedication}
              onBulkImportPast={handleBulkImportPast}
              onUpdatePastDedication={handleUpdatePastDedication}
              onDeletePastDedication={handleDeletePastDedication}
              onOpenCertificate={(record) => setSelectedCertificate(record)}
            />
          ) : (
            <AccessDeniedGate
              tabTitle={user?.role === 'fellowship_leader' ? 'Church Historical Archives' : 'Past Data List & Historical Archive'}
              tabDescription={
                user?.role === 'fellowship_leader'
                  ? 'Historical child dedication archives and certificate reprints are restricted to Church Office Administrators.'
                  : 'Church Office Archives are restricted to authenticated leadership. Sign in with Google to review historical child dedication records.'
              }
            />
          )
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-[#221107] text-white border-t-2 border-[#d4af37]/40 mt-16 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/10 text-xs sm:text-sm">
            {/* Church Identity */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center space-x-3">
                <ChurchLogo size={48} className="shadow-lg" />
                <div>
                  <span className="font-cinzel font-bold text-base text-[#ffd700] block">
                    DCI UTAWALA
                  </span>
                  <span className="text-xs text-gray-300 font-serif italic">
                    The Church of Choice
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed font-serif italic">
                "We are a Pentecostal Church Of Choice. Our Vision is to Transform and Empower Mankind in Africa and Beyond."
              </p>
            </div>

            {/* Navigation sequence */}
            <div className="space-y-2">
              <h4 className="font-cinzel font-bold text-[#ffd700] text-xs uppercase tracking-wider">
                Portal Navigation
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li>
                  <button onClick={() => setCurrentTab('about')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    About DCU
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('home')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Home
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('register')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Register Your Child
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('track')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Track Status (24h Review)
                  </button>
                </li>
              </ul>
            </div>

            {/* Staff & Leadership links */}
            <div className="space-y-2">
              <h4 className="font-cinzel font-bold text-[#ffd700] text-xs uppercase tracking-wider">
                Leadership Portals
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li>
                  <button onClick={() => setCurrentTab('leadership')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Leadership (Fellowship Approvals)
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('office_compile')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Office Compile (Admin Verification)
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('data_lists')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Active Data Lists
                  </button>
                </li>
                <li>
                  <button onClick={() => setCurrentTab('past_data')} className="hover:text-[#ffd700] transition-colors cursor-pointer">
                    Past Data List (Archives)
                  </button>
                </li>
              </ul>
            </div>

            {/* Church Office Contacts */}
            <div className="space-y-2">
              <h4 className="font-cinzel font-bold text-[#ffd700] text-xs uppercase tracking-wider">
                Church Information
              </h4>
              <p className="text-xs text-gray-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                Utawala, Eastern Bypass, Nairobi
              </p>
              <p className="text-xs text-gray-300 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                0723 102273
              </p>
              <p className="text-xs text-gray-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                dcutawala@gmail.com
              </p>
              <div className="pt-2">
                <a
                  href="/api/export/download-zip"
                  download="dcu-child-dedication-portal.zip"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#d4af37]/20 hover:bg-[#d4af37]/35 text-[#ffd700] border border-[#d4af37]/50 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] shadow-sm cursor-pointer"
                  title="Download complete project ZIP source code for GitHub / Vercel"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Download Project ZIP</span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-gray-400 gap-2">
            <p>
              &copy; {new Date().getFullYear()} Deliverance Church International Utawala. All Rights Reserved.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/api/export/download-zip"
                download="dcu-child-dedication-portal.zip"
                className="text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Download Portal Source (.ZIP)</span>
              </a>
              <span className="text-[#ffd700] hidden sm:inline">•</span>
              <p className="text-[#ffd700] flex items-center gap-1">
                Zones A to E Fellowship Care • Church Office Compilation
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Certificate Modal */}
      <CertificateModal
        record={selectedCertificate}
        onClose={() => setSelectedCertificate(null)}
      />

      {/* Auth Modal */}
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
