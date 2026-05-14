import { useState } from 'react';
import { Header } from './components/Header';
import { Onboarding } from './components/Onboarding';
import { DebugChat } from './components/DebugChat';
import { AppProvider, useApp } from './state/AppContext';

function AppShell() {
  const { apiKey } = useApp();
  const [changingKey, setChangingKey] = useState(false);

  const showOnboarding = !apiKey || changingKey;

  return (
    <div className="min-h-screen flex flex-col">
      <Header onChangeKey={apiKey ? () => setChangingKey(true) : undefined} />

      <main className="flex-1">
        {showOnboarding ? (
          <Onboarding
            reentry={!!apiKey}
            onCancel={changingKey ? () => setChangingKey(false) : undefined}
          />
        ) : (
          <DebugChat />
        )}
      </main>

      <footer className="border-t border-border bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 text-xs text-muted">
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
