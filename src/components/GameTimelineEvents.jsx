import { useRef } from 'react';
import ChampionMentionField from './ChampionMentionField';
import ChampionMentionDisplay from './ChampionMentionDisplay';
import EventTimeInput from './EventTimeInput';

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
      <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function TimelineEventRow({
  ev,
  seriesId,
  gameNumber,
  champions,
  gameChampions,
  getChampionIconUrl,
  updateSeriesEvent,
  removeSeriesEvent,
  readOnly,
}) {
  const textRef = useRef(null);

  if (readOnly) {
    return (
      <li className="history-event-row history-event-row-readonly">
        {ev.time ? <span className="history-event-time-readonly">[{ev.time}]</span> : null}
        <ChampionMentionDisplay
          text={ev.text}
          champions={champions}
          gameChampions={gameChampions}
          getChampionIconUrl={getChampionIconUrl}
          mentionMode="timeline"
          className="text-sm text-gray-400 flex-1 min-w-0"
        />
      </li>
    );
  }

  return (
    <li className="history-event-row">
      <EventTimeInput
        value={ev.time}
        onChange={(time) => updateSeriesEvent(seriesId, gameNumber, ev.id, { time })}
        onSecondsComplete={() => textRef.current?.focus()}
      />
      <div className="history-event-text-wrap">
        <ChampionMentionField
          inputRef={textRef}
          value={ev.text}
          onChange={(text) => updateSeriesEvent(seriesId, gameNumber, ev.id, { text })}
          placeholder="事件描述… @巴龍 @龍 @遠古龍 @藍B @紅B 或當局英雄"
          champions={champions}
          gameChampions={gameChampions}
          getChampionIconUrl={getChampionIconUrl}
          mentionMode="timeline"
          compact
          rows={1}
        />
      </div>
      <button
        type="button"
        className="history-event-remove"
        title="移除"
        onClick={() => removeSeriesEvent(seriesId, gameNumber, ev.id)}
      >
        ×
      </button>
    </li>
  );
}

export default function GameTimelineEvents({
  seriesId,
  gameNumber,
  events,
  champions,
  gameChampions,
  getChampionIconUrl,
  addSeriesEvent,
  updateSeriesEvent,
  removeSeriesEvent,
  readOnly = false,
}) {
  return (
    <div className="history-timeline">
      <div className="history-timeline-header">
        <span className="history-timeline-label">賽事時間軸</span>
        {!readOnly && (
          <button
            type="button"
            className="history-timeline-add"
            title="新增事件"
            onClick={() => addSeriesEvent(seriesId, gameNumber)}
          >
            <PlusIcon />
          </button>
        )}
      </div>
      {events.length === 0 ? (
        <p className="history-timeline-hint">{readOnly ? '—' : '點擊 + 新增時間事件'}</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <TimelineEventRow
              key={ev.id}
              ev={ev}
              seriesId={seriesId}
              gameNumber={gameNumber}
              champions={champions}
              gameChampions={gameChampions}
              getChampionIconUrl={getChampionIconUrl}
              updateSeriesEvent={updateSeriesEvent}
              removeSeriesEvent={removeSeriesEvent}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
