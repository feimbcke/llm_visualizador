import { Header } from './components/Header';
import { Login } from './components/Login';
import { WorkshopShell } from './components/WorkshopShell';
import { AppProvider, useApp } from './state/AppContext';

function AppShell() {
  const { authed, logout } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header onLogout={authed ? logout : undefined} />

      {authed ? (
        <WorkshopShell />
      ) : (
        <main className="flex-1">
          <Login />
        </main>
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
