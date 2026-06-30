import { championToMentionItem, getTimelineMentionItems } from '../constants/timelineObjectives';
import { findMentionItemAt, parseMentionItems, parseNoteMentions } from './championMention';

const ZWSP = '\u200B';

export function nodeToPlainText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent.replaceAll(ZWSP, '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.classList?.contains('mention-chip')) return node.dataset.mention || '';
  let text = '';
  node.childNodes.forEach((child) => {
    text += nodeToPlainText(child);
  });
  return text;
}

export function editorToPlainText(editor) {
  if (!editor) return '';
  return nodeToPlainText(editor).replaceAll(ZWSP, '');
}

export function fragmentToPlainText(fragment) {
  let text = '';
  fragment.childNodes.forEach((node) => {
    text += nodeToPlainText(node);
  });
  return text.replaceAll(ZWSP, '');
}

export function getPlainOffsetBeforeNode(editor, targetNode) {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEndBefore(targetNode);
  return fragmentToPlainText(range.cloneContents()).length;
}

export function getPlainTextBeforeCursor(editor) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !editor) return editorToPlainText(editor);
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(editor);
  pre.setEnd(range.endContainer, range.endOffset);
  return fragmentToPlainText(pre.cloneContents());
}

export function getCursorPlainOffset(editor) {
  return getPlainTextBeforeCursor(editor).length;
}

function plainOffsetToDomPosition(editor, offset) {
  let pos = 0;
  let result = { node: editor, offset: 0 };
  let placed = false;

  const walk = (node) => {
    if (placed) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent;
      let plainInNode = 0;
      for (let i = 0; i < content.length; i++) {
        if (content[i] === ZWSP) continue;
        if (pos + plainInNode >= offset) {
          result = { node, offset: i };
          placed = true;
          return;
        }
        plainInNode++;
      }
      pos += plainInNode;
      return;
    }

    if (node.classList?.contains('mention-chip')) {
      const len = (node.dataset.mention || '').length;
      if (offset === pos) {
        const idx = Array.from(editor.childNodes).indexOf(node);
        result = { node: editor, offset: idx };
        placed = true;
        return;
      }
      if (offset > pos && offset < pos + len) {
        const zwsp = node.nextSibling;
        if (zwsp?.nodeType === Node.TEXT_NODE) {
          result = { node: zwsp, offset: zwsp.textContent.length };
        } else {
          result = { node: editor, offset: Array.from(editor.childNodes).indexOf(node) + 1 };
        }
        placed = true;
        return;
      }
      pos += len;
      return;
    }

    node.childNodes.forEach(walk);
  };

  editor.childNodes.forEach(walk);

  if (!placed) {
    const last = editor.lastChild;
    if (last?.nodeType === Node.TEXT_NODE) {
      result = { node: last, offset: last.textContent.length };
    } else if (last?.classList?.contains('mention-chip')) {
      const zwsp = last.nextSibling;
      if (zwsp?.nodeType === Node.TEXT_NODE) {
        result = { node: zwsp, offset: zwsp.textContent.length };
      } else {
        result = { node: editor, offset: editor.childNodes.length };
      }
    } else {
      result = { node: editor, offset: editor.childNodes.length };
    }
  }

  return result;
}

export function setCursorPlainOffset(editor, offset) {
  if (!editor) return;
  const sel = window.getSelection();
  const range = document.createRange();
  const { node, offset: domOffset } = plainOffsetToDomPosition(editor, offset);
  range.setStart(node, domOffset);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function createMentionChip(item, trigger, getChampionIconUrl) {
  const chip = document.createElement('span');
  chip.className = 'mention-chip';
  chip.contentEditable = 'false';
  chip.dataset.mention = `${trigger}${item.name}`;
  chip.title = item.name;
  chip.setAttribute('aria-label', item.name);

  const img = document.createElement('img');
  img.className = 'mention-chip-img';
  img.draggable = false;
  img.alt = '';
  img.src = item.kind === 'objective' ? item.icon : getChampionIconUrl(item.id);
  img.onerror = () => {
    img.src = 'https://placehold.co/22x22/333/fff?text=?';
  };
  chip.appendChild(img);
  return chip;
}

function appendChipWithSpacer(editor, chip) {
  editor.appendChild(chip);
  editor.appendChild(document.createTextNode(ZWSP));
}

function getParseParts(text, mentionMode, gameChampions, champions) {
  if (!text) return [];
  if (mentionMode === 'timeline') {
    return parseMentionItems(text, getTimelineMentionItems(gameChampions), { onlyAt: true });
  }
  const gameItems = (gameChampions ?? []).map(championToMentionItem);
  const allItems = (champions ?? []).map(championToMentionItem);
  return parseNoteMentions(text, gameChampions, champions, gameItems, allItems);
}

export function renderEditorContent(editor, text, { mentionMode, gameChampions, champions, getChampionIconUrl }) {
  if (!editor) return;
  editor.innerHTML = '';
  const parts = getParseParts(text, mentionMode, gameChampions, champions);

  parts.forEach((part) => {
    if (part.type === 'text') {
      if (part.value) editor.appendChild(document.createTextNode(part.value));
      return;
    }
    if (part.type === 'mention') {
      appendChipWithSpacer(editor, createMentionChip(part.item, part.trigger, getChampionIconUrl));
      return;
    }
    if (part.type === 'champion') {
      appendChipWithSpacer(
        editor,
        createMentionChip(championToMentionItem(part.champion), part.trigger, getChampionIconUrl),
      );
    }
  });

  editor.dataset.empty = text ? 'false' : 'true';
}

export function plainHasRenderableMentions(plain, config) {
  const parts = getParseParts(plain, config.mentionMode, config.gameChampions, config.champions);
  return parts.some((p) => p.type === 'mention' || p.type === 'champion');
}

export function editorHasBareMentionSyntax(editor) {
  if (!editor) return false;
  for (const node of editor.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && /[@!！]/.test(node.textContent.replaceAll(ZWSP, ''))) {
      return true;
    }
  }
  return false;
}

/** 將純文字 @tag 轉為 chip。回傳是否有轉換。 */
export function commitMentionsToChips(editor, config) {
  if (!editor) return false;
  const plain = editorToPlainText(editor);
  if (!plainHasRenderableMentions(plain, config) || !editorHasBareMentionSyntax(editor)) {
    return false;
  }
  renderEditorContent(editor, plain, config);
  return true;
}

export function syncEditorFromPlain(editor, plainText, cursorOffset, config, onChange, onComplete) {
  if (!editor) return;
  editor.dataset.empty = plainText ? 'false' : 'true';
  onChange(plainText);
  renderEditorContent(editor, plainText, config);
  const cursor = cursorOffset ?? plainText.length;
  requestAnimationFrame(() => {
    setCursorPlainOffset(editor, cursor);
    editor.focus();
    onComplete?.();
  });
}

export function insertPlainMention(
  editor,
  plainText,
  cursorOffset,
  mention,
  item,
  onChange,
  config,
  onComplete,
  suffix = '',
) {
  const tagName = item.name;
  const before = plainText.slice(0, mention.atIdx);
  const after = plainText.slice(cursorOffset);
  const nextPlain = `${before}${mention.trigger}${tagName}${suffix}${after}`;
  const nextCursor = before.length + mention.trigger.length + tagName.length + suffix.length;
  syncEditorFromPlain(editor, nextPlain, nextCursor, config, onChange, onComplete);
}

export function getMentionChipBeforeCursor(editor) {
  const sel = window.getSelection();
  if (!sel?.rangeCount || !editor) return null;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return null;

  const { startContainer, startOffset } = range;

  if (startContainer.nodeType === Node.TEXT_NODE) {
    const before = startContainer.textContent.slice(0, startOffset);
    const plainBefore = before.replaceAll(ZWSP, '');
    if (plainBefore.length > 0) return null;

    let prev = startContainer.previousSibling;
    while (prev?.nodeType === Node.TEXT_NODE && !prev.textContent.replaceAll(ZWSP, '')) {
      prev = prev.previousSibling;
    }
    if (prev?.classList?.contains('mention-chip')) return prev;
    return null;
  }

  if (startContainer === editor && startOffset > 0) {
    let prev = startContainer.childNodes[startOffset - 1];
    while (prev?.nodeType === Node.TEXT_NODE && !prev.textContent.replaceAll(ZWSP, '')) {
      prev = prev.previousSibling;
    }
    if (prev?.classList?.contains('mention-chip')) return prev;
  }

  return null;
}

export function deleteMentionChipBeforeCursor(editor, chip, onChange, config, onComplete) {
  const mention = chip.dataset.mention || '';
  if (!mention) {
    chip.remove();
    onComplete?.();
    return;
  }
  const plain = editorToPlainText(editor);
  const offsetStart = getPlainOffsetBeforeNode(editor, chip);
  const nextPlain = plain.slice(0, offsetStart) + plain.slice(offsetStart + mention.length);
  syncEditorFromPlain(editor, nextPlain, offsetStart, config, onChange, onComplete);
}

export { ZWSP };
