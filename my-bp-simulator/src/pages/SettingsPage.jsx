import { useBp } from '../context/BpContext';

export default function SettingsPage() {
  const { myTeamName, saveMyTeamName, updateMyTeamNameInput, canEdit } = useBp();

  return (
    <section className="panel p-6">
      <label className="flex flex-col gap-2 max-w-md">
        <span className="text-sm text-gray-400">我方隊名</span>
        <input
          type="text"
          className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100"
          maxLength={20}
          placeholder="隊名"
          value={myTeamName}
          disabled={!canEdit}
          onChange={(e) => updateMyTeamNameInput(e.target.value)}
          onBlur={(e) => saveMyTeamName(e.target.value)}
        />
      </label>
    </section>
  );
}
