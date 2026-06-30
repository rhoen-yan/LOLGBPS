import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BpContext } from './context/BpContext';
import { useBpSimulator } from './hooks/useBpSimulator';
import AppNav from './components/AppNav';
import Modal from './components/Modal';
import SimulatorPage from './pages/SimulatorPage';
import AnalyticsPage from './pages/AnalyticsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const bp = useBpSimulator();

  return (
    <BpContext.Provider value={bp}>
      <BrowserRouter>
        <div className="my-0 mx-auto p-4 md:p-8 w-full max-w-[var(--container-max)]">
          <AppNav />
          <Routes>
            <Route path="/" element={<SimulatorPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </BrowserRouter>
      <Modal />
    </BpContext.Provider>
  );
}
