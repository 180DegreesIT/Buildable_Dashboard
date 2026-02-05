import { useState } from 'react';
import UploadWizard from './components/upload/UploadWizard';
import UploadHistory from './components/upload/UploadHistory';

type Page = 'upload' | 'history';

function App() {
  const [page, setPage] = useState<Page>('upload');

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <h1 className="text-lg font-semibold text-[#1A1A2E]">Buildable Dashboard</h1>
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setPage('upload')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                page === 'upload'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Upload Data
            </button>
            <button
              onClick={() => setPage('history')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                page === 'history'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              Upload History
            </button>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-8">
        {page === 'upload' && <UploadWizard onNavigateHistory={() => setPage('history')} />}
        {page === 'history' && <UploadHistory onNavigateUpload={() => setPage('upload')} />}
      </main>
    </div>
  );
}

export default App;
