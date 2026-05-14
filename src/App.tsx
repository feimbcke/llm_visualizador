import { useState } from 'react';
import { Header } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { WorkshopShell } from './components/WorkshopShell';
import { AppProvider, useApp } from './state/AppContext';

function AppShell() {
  const { apiKey } = useApp();
  const [changingKey, setChangingKey] = useState(false);

  const showOnboarding = !apiKey || changingKey;

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header onChangeKey={apiKey ? () => setChangingKey(true) : undefined} />

      {showOnboarding ? (
        <main className="flex-1">
          <Onboarding
            reentry={!!apiKey}
            onCancel={changingKey ? () => setChangingKey(false) : undefined}
          />
        </main>
      ) : (
        <WorkshopShell />
      )}

      <footer className="border-t border-border bg-white">
        <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-muted">
          Taller · Modelos de Lenguaje en Salud · Clínica Alemana
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
