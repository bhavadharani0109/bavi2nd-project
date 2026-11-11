import React from 'react';
import { Loader2 } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { BrandMark } from './components/BrandMark';
import { DashboardWorkspace } from './components/DashboardWorkspace';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';

function AppShell() {
  const { user, authReady } = useAuth();

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors">
        <BrandMark />
        <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin text-blue-700 dark:text-blue-500" />
          <span>Initializing secure session...</span>
        </div>
      </div>
    );
  }

  return user ? <DashboardWorkspace key={user.uid} /> : <AuthScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
