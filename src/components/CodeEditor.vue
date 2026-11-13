<script>
import 'monaco-editor/nls/lang/zh-cn.js'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import 'monaco-editor/features/bracketMatching/register.js'
import 'monaco-editor/features/caretOperations/register.js'
import 'monaco-editor/features/clipboard/register.js'
import 'monaco-editor/features/codicon/register.js'
import 'monaco-editor/features/comment/register.js'
import 'monaco-editor/features/contextmenu/register.js'
import 'monaco-editor/features/cursorUndo/register.js'
import 'monaco-editor/features/find/register.js'
import 'monaco-editor/features/folding/register.js'
import 'monaco-editor/features/fontZoom/register.js'
import 'monaco-editor/features/gotoLine/register.js'
import 'monaco-editor/features/hover/register.js'
import 'monaco-editor/features/indentation/register.js'
import 'monaco-editor/features/inPlaceReplace/register.js'
import 'monaco-editor/features/lineSelection/register.js'
import 'monaco-editor/features/linesOperations/register.js'
import 'monaco-editor/features/multicursor/register.js'
import 'monaco-editor/features/parameterHints/register.js'
import 'monaco-editor/features/quickCommand/register.js'
import 'monaco-editor/features/readOnlyMessage/register.js'
import 'monaco-editor/features/smartSelect/register.js'
import 'monaco-editor/features/snippet/register.js'
import 'monaco-editor/features/stickyScroll/register.js'
import 'monaco-editor/features/suggest/register.js'
import 'monaco-editor/features/wordHighlighter/register.js'
import 'monaco-editor/features/wordOperations/register.js'
import 'monaco-editor/features/wordPartOperations/register.js'
import 'monaco-editor/editor/browser/coreCommands.js'
import 'monaco-editor/editor/contrib/suggest/browser/suggestController.js'
import 'monaco-editor/editor/contrib/dropOrPasteInto/browser/copyPasteContribution.js'
import 'monaco-editor/languages/definitions/cpp/register.js'
import 'monaco-editor/languages/definitions/python/register.js'
import 'monaco-editor/languages/definitions/java/register.js'
import 'monaco-editor/languages/definitions/javascript/register.js'
import 'monaco-editor/languages/definitions/typescript/register.js'
import 'monaco-editor/languages/definitions/go/register.js'
import 'monaco-editor/languages/definitions/rust/register.js'
import 'monaco-editor/languages/definitions/csharp/register.js'
import 'monaco-editor/languages/definitions/kotlin/register.js'
import 'monaco-editor/languages/definitions/swift/register.js'
import 'monaco-editor/languages/definitions/php/register.js'
import 'monaco-editor/languages/definitions/ruby/register.js'
import 'monaco-editor/languages/definitions/lua/register.js'
import 'monaco-editor/languages/definitions/perl/register.js'
import 'monaco-editor/languages/definitions/r/register.js'
import 'monaco-editor/languages/definitions/shell/register.js'

self.MonacoEnvironment = {
  getWorker: (_, label) =>
    label === 'typescript' || label === 'javascript'
      ? import('../lsp/typescript.js').then((module) => module.createWorker())
      : new EditorWorker(),
}
monaco.editor.defineTheme('pioneer', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6E7074', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'E5A06D' },
    { token: 'keyword.directive', foreground: 'D497B4' },
    { token: 'annotation', foreground: 'D497B4' },
    { token: 'string', foreground: 'B8C78C' },
    { token: 'string.escape', foreground: 'E0C48A' },
    { token: 'string.invalid', foreground: 'E06C6C' },
    { token: 'regexp', foreground: 'D6A06E' },
    { token: 'number', foreground: 'D6B780' },
    { token: 'type', foreground: '9CC3C0' },
    { token: 'identifier', foreground: 'DAD9D6' },
    { token: 'delimiter', foreground: '9A9B9E' },
    { token: 'operator', foreground: 'C4C3C0' },
    { token: 'class', foreground: '9CC3C0' },
    { token: 'struct', foreground: '9CC3C0' },
    { token: 'enum', foreground: '9CC3C0' },
    { token: 'interface', foreground: '9CC3C0' },
    { token: 'concept', foreground: '9CC3C0' },
    { token: 'typeParameter', foreground: '9CC3C0', fontStyle: 'italic' },
    { token: 'function', foreground: '8FB8D8' },
    { token: 'method', foreground: '8FB8D8' },
    { token: 'decorator', foreground: 'D497B4' },
    { token: 'macro', foreground: 'D497B4' },
    { token: 'namespace', foreground: 'B9A3D6' },
    { token: 'module', foreground: 'B9A3D6' },
    { token: 'parameter', foreground: 'D9B99C' },
    { token: 'property', foreground: 'BCC8D4' },
    { token: 'enumMember', foreground: 'D6B780' },
    { token: 'variable.readonly', foreground: 'D6B780' },
    { token: 'label', foreground: 'D497B4' },
  ],
  colors: {
    'editor.background': '#141517',
    'editor.foreground': '#DAD9D6',
    'editorLineNumber.foreground': '#4E5054',
    'editorLineNumber.activeForeground': '#FF8A3D',
    'editor.lineHighlightBackground': '#1C1D20',
    'editorCursor.foreground': '#FF8A3D',
    'editor.selectionBackground': '#FF640C38',
    'editor.inactiveSelectionBackground': '#FF640C1C',
    'editorIndentGuide.background1': '#FFFFFF0B',
    'editorIndentGuide.activeBackground1': '#FFFFFF20',
    'editorBracketHighlight.foreground1': '#E0AD2A',
    'editorBracketHighlight.foreground2': '#E57BA3',
    'editorBracketHighlight.foreground3': '#7FB8C8',
    'editorBracketPairGuide.activeBackground1': '#E0AD2A66',
    'editorBracketPairGuide.activeBackground2': '#E57BA366',
    'editorBracketPairGuide.activeBackground3': '#7FB8C866',
    'editorBracketMatch.background': '#FF640C1F',
    'editorBracketMatch.border': '#FF8A3D99',
    'editor.findMatchBackground': '#FF640C66',
    'editor.findMatchHighlightBackground': '#FF640C2E',
    'editor.selectionHighlightBackground': '#FFFFFF14',
    'editor.wordHighlightBackground': '#FFFFFF12',
    'editor.wordHighlightStrongBackground': '#FFFFFF1C',
    'editorWidget.background': '#242529',
    'editorWidget.border': '#3A3B3E',
    'editorHoverWidget.background': '#242529',
    'editorHoverWidget.border': '#3A3B3E',
    'editorSuggestWidget.background': '#242529',
    'editorSuggestWidget.border': '#3A3B3E',
    'editorSuggestWidget.selectedBackground': '#3A3B3E',
    'editorSuggestWidget.highlightForeground': '#FF8A3D',
    'editorSuggestWidget.focusHighlightForeground': '#FF8A3D',
    'textLink.foreground': '#FF8A3D',
    'textLink.activeForeground': '#FFA463',
    'editorStickyScroll.background': '#18191B',
    'editorStickyScrollHover.background': '#232427',
    'editorStickyScroll.shadow': '#00000099',
    'editorGutter.foldingControlForeground': '#8C8E92',
    'menu.background': '#242529',
    'menu.foreground': '#DAD9D6',
    'menu.selectionBackground': '#3A3B3E',
    'menu.selectionForeground': '#FFFFFF',
    'menu.separatorBackground': '#3A3B3E',
    'menu.border': '#3A3B3E',
    'quickInput.background': '#242529',
    'quickInputList.focusBackground': '#3A3B3E',
    'list.hoverBackground': '#2E2F33',
    'list.activeSelectionBackground': '#3A3B3E',
    'list.highlightForeground': '#FF8A3D',
    'input.background': '#18191B',
    'input.border': '#3A3B3E',
    'inputOption.activeBorder': '#FF640C',
    'widget.shadow': '#00000080',
    'focusBorder': '#FF640C',
    'scrollbarSlider.background': '#8C8E9230',
    'scrollbarSlider.hoverBackground': '#8C8E9250',
  },
})
</script>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { languageById } from '../../shared/languages.js'
import { sourceFacts } from '../sourceFacts.js'
import { attachLanguageService, detachLanguageService } from '../lsp/index.js'

const props = defineProps({ modelValue: String, language: String, disabled: Boolean, marks: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'run', 'save', 'cursor'])
const element = ref(null)
let editor
let model
let marks

async function analyze(source, language) {
  const facts = sourceFacts(source, language)
  if (facts.codeLines !== undefined) return facts
  const mode = languageById[language].editor
  // 等待已有高亮词法器就绪；无需后端或额外解析库。
  await monaco.editor.colorize('', mode, {})
  return sourceFacts(source, language, monaco.editor.tokenize(source, mode))
}
defineExpose({ analyze })

onMounted(() => {
  model = createModel(props.language, props.modelValue)
  editor = monaco.editor.create(element.value, {
    model, theme: 'pioneer', automaticLayout: true, fixedOverflowWidgets: true,
    readOnly: props.disabled, readOnlyMessage: { value: '评测中，暂不可编辑' },
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace", fontSize: 14, lineHeight: 22, fontLigatures: false,
    padding: { top: 14, bottom: 14 }, tabSize: 4, detectIndentation: true, minimap: { enabled: false },
    scrollBeyondLastLine: false, overviewRulerLanes: 0, hideCursorInOverviewRuler: true,
    lineNumbersMinChars: 3, lineDecorationsWidth: 10, glyphMargin: false,
    folding: true, showFoldingControls: 'mouseover',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: 'active', indentation: true, highlightActiveIndentation: true },
    stickyScroll: { enabled: true, maxLineCount: 3 },
    renderLineHighlight: 'all', renderWhitespace: 'selection',
    cursorBlinking: 'smooth', cursorSmoothCaretAnimation: 'on', smoothScrolling: true, mouseWheelZoom: true,
    quickSuggestions: { other: true, comments: false, strings: false }, suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'currentDocument', parameterHints: { enabled: true }, hover: { enabled: true, delay: 400 },
    'semanticHighlighting.enabled': true, contextmenu: true, ariaLabel: '源代码',
  })
  marks = editor.createDecorationsCollection()
  showMarks()
  document.fonts?.load("14px 'JetBrains Mono'").then(() => monaco.editor.remeasureFonts())
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => emit('run', 'sample'))
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => emit('run', 'submit'))
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => emit('save'))
  const cursor = () => {
    const selection = editor.getSelection()
    emit('cursor', { line: selection.positionLineNumber, column: selection.positionColumn, selected: model.getValueInRange(selection).length })
  }
  editor.onDidChangeCursorSelection(cursor)
  cursor()
  editor.onDidChangeModelContent(() => emit('update:modelValue', editor.getValue()))
  attachLanguageService(model, props.language)
})
function createModel(language, value) {
  const { editor: mode, filename } = languageById[language]
  return monaco.editor.createModel(value, mode, monaco.Uri.file(`/workspace/${filename}`))
}
watch(() => props.modelValue, value => {
  if (editor && value !== editor.getValue()) editor.setValue(value)
})
watch(() => props.language, (language) => {
  if (!editor) return
  const previous = model
  model = createModel(language, props.modelValue)
  editor.setModel(model)
  attachLanguageService(model, language)
  previous.dispose()
  showMarks()
})
function showMarks() {
  marks?.set(props.marks.map(({ from, to, message }) => {
    const start = model.getPositionAt(from)
    const end = model.getPositionAt(to)
    return {
      range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
      options: { inlineClassName: 'contract-mark', linesDecorationsClassName: 'contract-gutter', hoverMessage: { value: message }, stickiness: 1 },
    }
  }))
}
watch(() => props.marks, showMarks)
watch(() => props.disabled, readOnly => editor?.updateOptions({ readOnly }))
onBeforeUnmount(() => {
  detachLanguageService()
  editor?.dispose()
  model?.dispose()
})
</script>

<template>
  <div ref="element" class="source-editor monaco-component" />
</template>

<style scoped>
.source-editor { height: 100%; min-width: 0 }
</style>
