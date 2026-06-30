import { BpContext } from '../context/BpContext';
import { useBpSimulator } from '../hooks/useBpSimulator';
import Header from '../components/Header';
import DraftArena from '../components/DraftArena';
import SeriesHistoryPanel from '../components/SeriesHistoryPanel';
import Modal from '../components/Modal';

export default function SimulatorPage() {
  const bp = useBpSimulator();

  return (
    <BpContext.Provider value={bp}>
      <Header />
      <DraftArena />
      <SeriesHistoryPanel />
      <Modal />
    </BpContext.Provider>
  );
}
