import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  championToMentionItem,
  getTimelineMentionItems,
} from '../constants/timelineObjectives';
import {
  filterChampionsForMention,
  filterMentionItems,
  getMentionContext,
  resolveExactMentionItem,
} from '../utils/championMention';
import {
  commitMentionsToChips,
  deleteMentionChipBeforeCursor,
  editorToPlainText,
  getCursorPlainOffset,
  getMentionChipBeforeCursor,
  getPlainTextBeforeCursor,
  insertPlainMention,
  renderEditorContent,
  setCursorPlainOffset,
} from '../utils/mentionEditor';

export default function ChampionMentionField({
  value,
  onChange,
  placeholder,
  champions,
  gameChampions,
  getChampionIconUrl,
  compact = false,
  rows = 2,
  inputRef,
  mentionMode = 'note',
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [cursorTick, setCursorTick] = useState(0);
  const [isEmpty, setIsEmpty] = useState(!(value || ''));
  const syncingRef = useRef(false);
  const composingRef = useRef(false);
  const skipNextInputRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onlyAt = mentionMode === 'timeline';

  const timelineItems = useMemo(
    () => getTimelineMentionItems(gameChampions),
    [gameChampions],
  );

  const gameItems = useMemo(
    () => (gameChampions ?? []).map(championToMentionItem),
    [gameChampions],
  );

  const allItems = useMemo(
    () => (champions ?? []).map(championToMentionItem),
    [champions],
  );

  const editorConfig = useMemo(
    () => ({ mentionMode, gameChampions, champions, getChampionIconUrl }),
    [mentionMode, gameChampions, champions, getChampionIconUrl],
  );
  const editorConfigRef = useRef(editorConfig);
  editorConfigRef.current = editorConfig;

  const resolvePool = useCallback(
    (trigger) => {
      if (mentionMode === 'timeline') return timelineItems;
      return trigger === '!' ? allItems : gameItems;
    },
    [mentionMode, timelineItems, allItems, gameItems],
  );

  const setEditorRef = useCallback(
    (el) => {
      editorRef.current = el;
      if (el) {
        const focused = document.activeElement === el;
        const domPlain = editorToPlainText(el);
        const shouldRender =
          el.childNodes.length === 0 || (!focused && domPlain !== (valueRef.current || ''));
        if (shouldRender) {
          renderEditorContent(el, valueRef.current || '', editorConfigRef.current);
        }
        setIsEmpty(!(valueRef.current || ''));
      }
      if (!inputRef) return;
      if (typeof inputRef === 'function') inputRef(el);
      else inputRef.current = el;
    },
    [inputRef],
  );

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || syncingRef.current) return;
    if (document.activeElement === editor) return;
    const current = editorToPlainText(editor);
    if (current !== (value || '')) {
      renderEditorContent(editor, value || '', editorConfigRef.current);
      setIsEmpty(!(value || ''));
    }
  }, [value]);

  const plainBeforeCursor = useMemo(() => {
    void cursorTick;
    const editor = editorRef.current;
    if (!editor) return '';
    return getPlainTextBeforeCursor(editor);
  }, [cursorTick]);

  const mention = useMemo(
    () =>
      getMentionContext(plainBeforeCursor, plainBeforeCursor.length, {
        onlyAt,
        resolvePool,
      }),
    [plainBeforeCursor, onlyAt, resolvePool],
  );

  const mentionItems = useMemo(() => {
    if (!mention) return [];
    if (mentionMode === 'timeline') return timelineItems;
    if (mention.trigger === '!') return allItems;
    return gameItems;
  }, [mention, mentionMode, timelineItems, allItems, gameItems]);

  const championSuggestions = useMemo(() => {
    if (!mention || mentionMode === 'timeline') return [];
    return filterChampionsForMention(
      mention.trigger === '!' ? champions : (gameChampions ?? []),
      mention.query,
      mention.trigger === '!' ? 30 : 12,
    );
  }, [mention, mentionMode, champions, gameChampions]);

  const itemSuggestions = useMemo(() => {
    if (!mention || mentionMode !== 'timeline') return [];
    return filterMentionItems(mentionItems, mention.query, 20);
  }, [mention, mentionMode, mentionItems]);

  const suggestions = mentionMode === 'timeline' ? itemSuggestions : championSuggestions;
  const useItemSuggestions = mentionMode === 'timeline';

  useEffect(() => {
    setHighlightIndex(suggestions.length > 0 ? 0 : -1);
  }, [mention?.atIdx, mention?.query, mention?.trigger, suggestions.length]);

  const bumpCursor = useCallback(() => {
    setCursorTick((n) => n + 1);
  }, []);

  const tryCommitMentions = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || composingRef.current) return;
    const cursor = getCursorPlainOffset(editor);
    const config = editorConfigRef.current;
    syncingRef.current = true;
    if (commitMentionsToChips(editor, config)) {
      requestAnimationFrame(() => {
        setCursorPlainOffset(editor, cursor);
        syncingRef.current = false;
        bumpCursor();
      });
    } else {
      syncingRef.current = false;
    }
  }, [bumpCursor]);

  const syncPlainFromDom = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || composingRef.current) return;
    const plain = editorToPlainText(editor);
    setIsEmpty(!plain);
    if (plain !== valueRef.current) {
      syncingRef.current = true;
      onChange(plain);
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    }
    bumpCursor();
  }, [onChange, bumpCursor]);

  const handleInput = useCallback(() => {
    if (skipNextInputRef.current) {
      skipNextInputRef.current = false;
      return;
    }
    syncPlainFromDom();
    tryCommitMentions();
  }, [syncPlainFromDom, tryCommitMentions]);

  useEffect(() => {
    if (!mention) return;
    const handlePointerDown = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      bumpCursor();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [mention, bumpCursor]);

  const insertMention = useCallback(
    (item, suffix = '') => {
      const editor = editorRef.current;
      if (!editor || !mention) return;
      const plain = editorToPlainText(editor);
      const cursor = getCursorPlainOffset(editor);
      setHighlightIndex(-1);
      syncingRef.current = true;
      insertPlainMention(
        editor,
        plain,
        cursor,
        mention,
        item,
        onChange,
        editorConfigRef.current,
        () => {
          syncingRef.current = false;
          setIsEmpty(!editorToPlainText(editor));
          bumpCursor();
        },
        suffix,
      );
    },
    [mention, onChange, bumpCursor],
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && !e.metaKey && !e.ctrlKey) {
      const editor = editorRef.current;
      const chip = getMentionChipBeforeCursor(editor);
      if (chip) {
        e.preventDefault();
        syncingRef.current = true;
        deleteMentionChipBeforeCursor(editor, chip, onChange, editorConfigRef.current, () => {
          syncingRef.current = false;
          setIsEmpty(!editorToPlainText(editor));
          bumpCursor();
        });
        return;
      }
    }

    if (mention) {
      const exactItem = resolveExactMentionItem(
        plainBeforeCursor,
        mention,
        resolvePool(mention.trigger),
      );
      if (e.key === ' ' && exactItem) {
        e.preventDefault();
        insertMention(exactItem, ' ');
        return;
      }
    }

    if (mention && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        return;
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && highlightIndex >= 0) {
        e.preventDefault();
        insertMention(suggestions[highlightIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setHighlightIndex(-1);
        return;
      }
    }

    if (compact && e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    syncPlainFromDom();
    tryCommitMentions();
  };

  const inputCls = compact
    ? 'history-event-text mention-editor'
    : 'history-note mention-editor custom-scroll';

  const showSuggestions = Boolean(mention);

  const getSuggestionIcon = (item) => {
    if (useItemSuggestions && item.kind === 'objective') return item.icon;
    if (item.kind === 'objective') return item.icon;
    return getChampionIconUrl(item.id);
  };

  const minHeight = compact ? undefined : `${Math.max(rows * 1.5, 2.5)}rem`;

  return (
    <div className="mention-field relative" ref={containerRef}>
      <div
        ref={setEditorRef}
        className={inputCls}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={!compact}
        data-placeholder={placeholder}
        data-empty={isEmpty ? 'true' : 'false'}
        style={minHeight ? { minHeight } : undefined}
        onInput={handleInput}
        onCompositionStart={() => {
          composingRef.current = true;
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
          skipNextInputRef.current = true;
          syncPlainFromDom();
          tryCommitMentions();
        }}
        onClick={bumpCursor}
        onKeyUp={bumpCursor}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          const editor = editorRef.current;
          if (!editor) return;
          const plain = editorToPlainText(editor);
          syncingRef.current = true;
          if (plain !== valueRef.current) onChange(plain);
          commitMentionsToChips(editor, editorConfigRef.current);
          setIsEmpty(!editorToPlainText(editor));
          requestAnimationFrame(() => {
            syncingRef.current = false;
          });
        }}
      />
      {showSuggestions && (
        <ul
          className="mention-suggestions custom-scroll"
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.length > 0 ? (
            suggestions.map((item, i) => (
              <li key={`${item.kind || 'champ'}-${item.id}`}>
                <button
                  type="button"
                  className={`mention-suggestion-btn${i === highlightIndex ? ' is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => insertMention(item)}
                >
                  <img
                    src={getSuggestionIcon(item)}
                    alt=""
                    className="mention-suggestion-icon"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/22x22/333/fff?text=?';
                    }}
                  />
                  <span className="mention-suggestion-name">{item.name}</span>
                  <span className="mention-suggestion-hint">
                    {mention.trigger}
                    {item.name}
                  </span>
                </button>
              </li>
            ))
          ) : (
            <li className="mention-suggestion-empty">
              {mentionMode === 'timeline' || mention.trigger === '@' ? '無符合項目' : '無符合英雄'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
