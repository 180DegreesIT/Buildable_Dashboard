import { useState } from 'react';
import { SettingsProvider } from './lib/SettingsContext';
import { WeekProvider } from './lib/WeekContext';
import Sidebar, { type PageId } from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import ExecutiveSummary from './components/dashboard/ExecutiveSummary';
import FinancialDeepDive from './components/dashboard/FinancialDeepDive';
import RegionalPerformance from './components/dashboard/RegionalPerformance';
import UploadWizard from './components/upload/UploadWizard';
import UploadHistory from './components/upload/UploadHistory';
import TargetManagement from './components/targets/TargetManagement';
import AdminSettings from './components/admin/AdminSettings';
import UserManagement from './components/users/UserManagement';

type DataManagementView = 'upload' | 'history';

function App() {
  const [activePage, setActivePage] = useState<PageId>('executive_summary');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dataView, setDataView] = useState<DataManagementView>('upload');

  function handleNavigate(page: PageId) {
    setActivePage(page);
    if (page === 'data_management') {
      setDataView('upload');
    }
  }

  return (
    <SettingsProvider>
      <WeekProvider>
        <div className="h-screen flex bg-[#F9FAFB]">
          {/* Sidebar */}
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          />

          {/* Main area */}
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar />

            <main className="flex-1 overflow-y-auto px-8 py-6">
              {activePage === 'executive_summary' && <ExecutiveSummary />}

              {activePage === 'financial' && <FinancialDeepDive />}

              {activePage === 'regional_performance' && <RegionalPerformance />}

              {activePage === 'data_management' && (
                <div>
                  {/* Sub-nav for data management */}
                  <div className="flex items-center gap-1 mb-6">
                    <button
                      onClick={() => setDataView('upload')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        dataView === 'upload'
                          ? 'bg-[#4573D2]/10 text-[#4573D2]'
                          : 'text-[#6B7280] hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Upload Data
                    </button>
                    <button
                      onClick={() => setDataView('history')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        dataView === 'history'
                          ? 'bg-[#4573D2]/10 text-[#4573D2]'
                          : 'text-[#6B7280] hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      Upload History
                    </button>
                  </div>

                  {dataView === 'upload' && (
                    <UploadWizard onNavigateHistory={() => setDataView('history')} />
                  )}
                  {dataView === 'history' && (
                    <UploadHistory onNavigateUpload={() => setDataView('upload')} />
                  )}
                </div>
              )}

              {activePage === 'target_management' && <TargetManagement />}

              {activePage === 'admin_settings' && <AdminSettings />}

              {activePage === 'user_management' && <UserManagement />}
            </main>
          </div>
        </div>
      </WeekProvider>
    </SettingsProvider>
  );
}

export default App;
