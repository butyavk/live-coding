// CodeMirror 6 editor for the practice components. Loaded lazily (client.ts imports this module
// when the first editor scrolls into view), themed from Starlight's CSS variables so it follows
// the light and dark themes. Ctrl/Cmd+Enter runs, Ctrl/Cmd+Shift+Enter checks.
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, placeholder as placeholderExt, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { tags as t } from '@lezer/highlight';

export interface EditorOptions {
  lang: 'sql' | 'python';
  doc: string;
  label: string;
  placeholder?: string;
  schema?: Record<string, string[]>;
  onRun?: () => void;
  onCheck?: () => void;
  onChange?: (doc: string) => void;
}

export interface Editor {
  view: EditorView;
  get(): string;
  set(text: string): void;
  /** The selected text and its first line (0-based), or the whole document. */
  selectionOrAll(): { text: string; lineOffset: number };
  markLine(line: number): void;
  goLine(line: number): void;
  focus(): void;
}

const style = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword, t.definitionKeyword], color: 'var(--lcp-tok-keyword)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--lcp-tok-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--lcp-tok-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--lcp-tok-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.standard(t.name)], color: 'var(--lcp-tok-function)' },
  { tag: [t.typeName, t.className, t.definition(t.variableName)], color: 'var(--lcp-tok-type)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--lcp-tok-property)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--lcp-tok-punct)' },
]);

const theme = EditorView.theme({
  '&': {
    fontSize: '0.86rem',
    color: 'var(--sl-color-white)',
    backgroundColor: 'var(--lcp-editor-bg)',
    border: '1px solid var(--sl-color-gray-5)',
    borderRadius: '0.45rem',
  },
  '&.cm-focused': { outline: '2px solid var(--sl-color-accent)', outlineOffset: '1px' },
  '.cm-scroller': { fontFamily: 'var(--sl-font-mono)', lineHeight: '1.55', minHeight: '7.5rem', maxHeight: '28rem' },
  '.cm-content': { caretColor: 'var(--sl-color-accent-high)', padding: '0.5rem 0' },
  '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--sl-color-gray-3)', border: 'none', borderRight: '1px solid var(--sl-color-gray-6)' },
  '.cm-activeLine': { backgroundColor: 'var(--lcp-editor-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--lcp-editor-active)', color: 'var(--sl-color-gray-2)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--lcp-editor-selection) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--sl-color-white)' },
  '.cm-placeholder': { color: 'var(--sl-color-gray-3)' },
  '.cm-matchingBracket': { backgroundColor: 'var(--lcp-editor-selection)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--sl-color-bg-nav, var(--sl-color-black))', border: '1px solid var(--sl-color-gray-5)', color: 'var(--sl-color-white)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--sl-color-accent-low)', color: 'var(--sl-color-white)' },
  '.lcp-err-line': { backgroundColor: 'var(--lcp-fail-bg)', boxShadow: 'inset 3px 0 0 var(--lcp-fail)' },
});

// Error line: highlighted until the next edit.
const setErr = StateEffect.define<number | null>();
const errField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    if (tr.docChanged) return Decoration.none;
    for (const e of tr.effects) {
      if (e.is(setErr)) {
        if (e.value === null || e.value < 1 || e.value > tr.state.doc.lines) return Decoration.none;
        const line = tr.state.doc.line(e.value);
        return Decoration.set([Decoration.line({ class: 'lcp-err-line' }).range(line.from)]);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export function createEditor(host: HTMLElement, o: EditorOptions): Editor {
  const runKeys = [
    { key: 'Mod-Shift-Enter', run: () => (o.onCheck ? (o.onCheck(), true) : false), preventDefault: true },
    { key: 'Mod-Enter', run: () => (o.onRun ? (o.onRun(), true) : false), preventDefault: true },
  ];
  const lang: Extension =
    o.lang === 'sql'
      ? sql({ dialect: PostgreSQL, schema: o.schema, upperCaseKeywords: true })
      : python();
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    drawSelection(),
    indentOnInput(),
    indentUnit.of('    '),
    EditorState.tabSize.of(4),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ activateOnTyping: true, icons: false }),
    highlightActiveLine(),
    keymap.of([...runKeys, ...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
    syntaxHighlighting(style),
    theme,
    lang,
    errField,
    EditorView.contentAttributes.of({ 'aria-label': o.label }),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) o.onChange?.(u.state.doc.toString());
    }),
  ];
  if (o.placeholder) extensions.push(placeholderExt(o.placeholder));
  const view = new EditorView({ parent: host, state: EditorState.create({ doc: o.doc, extensions }) });
  return {
    view,
    get: () => view.state.doc.toString(),
    set(text: string) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    selectionOrAll() {
      const sel = view.state.selection.main;
      if (sel.empty) return { text: view.state.doc.toString(), lineOffset: 0 };
      return { text: view.state.sliceDoc(sel.from, sel.to), lineOffset: view.state.doc.lineAt(sel.from).number - 1 };
    },
    markLine(line: number) {
      view.dispatch({ effects: setErr.of(line) });
    },
    goLine(line: number) {
      if (line < 1 || line > view.state.doc.lines) return;
      const l = view.state.doc.line(line);
      view.dispatch({ selection: { anchor: l.from }, effects: [setErr.of(line), EditorView.scrollIntoView(l.from, { y: 'center' })] });
      view.focus();
    },
    focus: () => view.focus(),
  };
}
