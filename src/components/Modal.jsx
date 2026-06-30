import { useBp } from '../context/BpContext';

export default function Modal() {
  const { modal, hideModal, confirmModal } = useBp();

  if (!modal.open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="panel p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-2">{modal.title}</h3>
        <p className="text-sm text-gray-400 mb-5">{modal.text}</p>
        {modal.mode === 'alert' ? (
          <button
            type="button"
            className="w-full py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold text-sm"
            onClick={hideModal}
          >
            了解
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm"
              onClick={hideModal}
            >
              取消
            </button>
            <button
              type="button"
              className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm"
              onClick={confirmModal}
            >
              {modal.confirmLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
