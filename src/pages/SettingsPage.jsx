import { LANES } from '../constants/lanes';
import { useBp } from '../context/BpContext';

export default function SettingsPage() {
  const {
    myTeamName,
    lanePlayers,
    saveMyTeamName,
    updateMyTeamNameInput,
    updateLanePlayer,
    saveLanePlayer,
    canEdit,
  } = useBp();

  return (
    <section className="panel p-6 space-y-6">
      <label className="flex flex-col gap-2 max-w-md">
        <span className="text-sm text-gray-400">我方隊伍名稱</span>
        <input
          type="text"
          className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100"
          maxLength={20}
          placeholder="隊伍名稱"
          value={myTeamName}
          disabled={!canEdit}
          onChange={(e) => updateMyTeamNameInput(e.target.value)}
          onBlur={(e) => saveMyTeamName(e.target.value)}
        />
      </label>

      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">路線選手</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {LANES.map((lane) => (
            <div key={lane.id} className="lane-player-card">
              <div className="flex items-center gap-2 mb-3">
                <img src={lane.icon} alt={lane.label} className="w-6 h-6 object-contain" />
                <span className="text-sm font-semibold text-gray-200">{lane.label}</span>
              </div>
              {[0, 1].map((slot) => (
                <label key={slot} className="flex flex-col gap-1 text-xs text-gray-500 mb-2 last:mb-0">
                  選手 {slot + 1}
                  <input
                    type="text"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100"
                    maxLength={20}
                    placeholder={`選手 ${slot + 1}`}
                    value={lanePlayers?.[lane.id]?.[slot] ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => updateLanePlayer(lane.id, slot, e.target.value)}
                    onBlur={(e) => saveLanePlayer(lane.id, slot, e.target.value)}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
