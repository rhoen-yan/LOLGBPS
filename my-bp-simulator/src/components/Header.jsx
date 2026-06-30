import { useBp } from '../context/BpContext';
import SeriesFormatSelect from './SeriesFormatSelect';

export default function Header() {
  const {
    teamNames,
    saveTeamName,
    updateTeamNameInput,
    teamInputsLocked,
    currentSeriesScore,
    currentGameNumber,
    phaseInfo,
    startButtonState,
    resetGameButtonDisabled,
    showWinnerButtons,
    getTeamName,
    startDraft,
    resetCurrentGame,
    resetSeries,
    declareWinner,
    seriesLength,
    seriesStarted,
    setSeriesLength,
    ourSide,
    toggleOurSide,
    canChangeOurSide,
    teamsBarFlash,
  } = useBp();

  return (
    <header className="panel p-6 mb-6">
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        <div
          className={`team-bar flex flex-wrap items-center gap-3 lg:justify-self-start${teamsBarFlash ? ' team-bar-flash' : ''}`}
        >
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={ourSide === 'Blue'}
                disabled={!canChangeOurSide}
                onChange={() => toggleOurSide('Blue')}
              />
              我方
            </label>
            <input
              className="team-input text-blue-400"
              maxLength={20}
              placeholder="藍方"
              value={teamNames.Blue}
              disabled={teamInputsLocked}
              onFocus={() => updateTeamNameInput('Blue', '')}
              onChange={(e) => updateTeamNameInput('Blue', e.target.value)}
              onBlur={(e) => saveTeamName('Blue', e.target.value)}
            />
            <span className="text-2xl font-bold tabular-nums">{currentSeriesScore.Blue}</span>
          </div>
          <SeriesFormatSelect
            value={seriesLength}
            disabled={seriesStarted}
            onChange={setSeriesLength}
          />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{currentSeriesScore.Red}</span>
            <input
              className="team-input text-red-400"
              maxLength={20}
              placeholder="紅方"
              value={teamNames.Red}
              disabled={teamInputsLocked}
              onFocus={() => updateTeamNameInput('Red', '')}
              onChange={(e) => updateTeamNameInput('Red', e.target.value)}
              onBlur={(e) => saveTeamName('Red', e.target.value)}
            />
            <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-red-500"
                checked={ourSide === 'Red'}
                disabled={!canChangeOurSide}
                onChange={() => toggleOurSide('Red')}
              />
              我方
            </label>
          </div>
        </div>

        <div className="header-phase flex flex-col justify-center items-center text-center gap-1">
          <p className="text-sm text-gray-500 leading-tight">
            Game <span className="font-semibold text-white">{currentGameNumber}</span> / {seriesLength}
          </p>
          {phaseInfo.html ? (
            <p
              className="text-base font-medium text-yellow-400 leading-tight"
              dangerouslySetInnerHTML={{ __html: phaseInfo.content }}
            />
          ) : (
            <p className="text-base font-medium text-yellow-400 leading-tight">{phaseInfo.text}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 justify-center lg:justify-self-end lg:justify-end">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={startButtonState.disabled}
            onClick={startDraft}
          >
            {startButtonState.text}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={resetGameButtonDisabled}
            onClick={resetCurrentGame}
          >
            重置本局
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition"
            onClick={resetSeries}
          >
            重置系列賽
          </button>
        </div>
      </div>

      {showWinnerButtons && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="px-4 py-2 mr-[5px] rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold"
            onClick={() => declareWinner('Blue')}
          >
            {getTeamName('Blue')} 勝
          </button>
          <button
            type="button"
            className="px-4 py-2 mr-[5px] rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
            onClick={() => declareWinner('Red')}
          >
            {getTeamName('Red')} 勝
          </button>
        </div>
      )}
    </header>
  );
}
