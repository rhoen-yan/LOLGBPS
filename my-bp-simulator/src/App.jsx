import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppNav from './components/AppNav';
import SimulatorPage from './pages/SimulatorPage';
import AnalyticsPage from './pages/AnalyticsPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="my-0 mx-auto p-4 md:p-8 w-full max-w-[var(--container-max)]">
        <AppNav />
        <Routes>
          <Route path="/" element={<SimulatorPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
