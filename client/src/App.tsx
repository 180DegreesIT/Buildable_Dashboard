import { useState } from 'react';
import { WeekProvider } from './lib/WeekContext';
import Sidebar, { type PageId } from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import PlaceholderPage from './components/layout/PlaceholderPage';
import ExecutiveSummary from './components/dashboard/ExecutiveSummary';
import UploadWizard from './components/upload/UploadWizard';
import UploadHistory from './components/upload/UploadHistory';

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

            {activePage === 'financial' && (
              <PlaceholderPage
                title="Financial Deep Dive"
                description="Detailed P&L breakdown and financial metrics. Coming in Task 10."
              />
            )}

            {activePage === 'regional_performance' && (
              <PlaceholderPage
                title="Regional Performance"
                description="Team performance vs targets by region. Coming in Task 11."
              />
            )}

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

            {activePage === 'target_management' && (
              <PlaceholderPage
                title="Target Management"
                description="Set and manage targets for net profit, revenue, and team performance. Coming in Task 12."
              />
            )}

            {activePage === 'admin_settings' && (
              <PlaceholderPage
                title="Admin Settings"
                description="System configuration and settings. Coming in Task 13."
              />
            )}

            {activePage === 'user_management' && (
              <PlaceholderPage
                title="User Management"
                description="Manage users, roles, and page-level permissions. Coming in Task 13."
              />
            )}
          </main>
        </div>
      </div>
    </WeekProvider>
  );
}

export default App;
