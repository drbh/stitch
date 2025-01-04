<!-- components/DocumentEditor.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let content = '';
  export let cursorPosition = { line: 1, column: 1 };
  export let scrollTop = 0;

  let editor;
  let lineNumbers;

  $: if (content) {
    updateLineNumbers();
  }

  function handleKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;

      if (start !== end) {
        // Multi-line tab handling
        const text = editor.value;
        const startLine = text.substring(0, start).split('\n').length - 1;
        const endLine = text.substring(0, end).split('\n').length - 1;

        const lines = text.split('\n');
        for (let i = startLine; i <= endLine; i++) {
          lines[i] = '  ' + lines[i];
        }

        const newContent = lines.join('\n');
        dispatch('change', { content: newContent });
        updateLineNumbers();
      } else {
        // Single-line tab
        const newContent = content.substring(0, start) + '  ' + content.substring(end);
        dispatch('change', { content: newContent });
        editor.selectionStart = editor.selectionEnd = start + 2;
      }
    }
  }

  function handleInput(e) {
    dispatch('change', { content: e.target.value });
    updateLineNumbers();
  }

  function updateCursorPosition() {
    if (!editor) return;
    const text = editor.value.substring(0, editor.selectionStart);
    const lines = text.split('\n');
    const newPosition = {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
    dispatch('cursorMove', newPosition);
    updateLineNumbers();
  }

  function updateLineNumbers() {
    if (!editor) return;
    const lines = editor.value.split('\n').length;
    lineNumbers = Array.from({ length: lines }, (_, i) => i + 1);
  }

  function handleScroll() {
    if (!editor) return;
    const newScrollTop = editor.scrollTop;
    dispatch('scroll', { scrollTop: newScrollTop });
  }
</script>

<div class="editor-content">
  <div class="line-numbers" style="transform: translateY(-{scrollTop}px)">
    {#each lineNumbers || [] as num}
      <div class="line-number">{num}</div>
    {/each}
  </div>
  <textarea
    bind:this={editor}
    value={content}
    on:keydown={handleKeydown}
    on:input={handleInput}
    on:select={updateCursorPosition}
    on:click={updateCursorPosition}
    on:scroll={handleScroll}
    spellcheck="false"
  ></textarea>
</div>

<style>
  .editor-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
    height: 100%;
  }

  .line-numbers {
    padding: 0.5rem 0.75rem;
    background: var(--bg-dark);
    border-right: 1px solid var(--border);
    user-select: none;
    color: var(--text-muted);
    position: sticky;
    left: 0;
    z-index: 1;
  }

  .line-number {
    /* font-family: monospace; */
    font-size: 14px;
    line-height: 1.5;
    text-align: right;
    min-width: 2ch;
  }

  textarea {
    flex: 1;
    background: var(--bg);
    color: var(--text);
    border: none;
    padding: 0.5rem;
    /* font-family: monospace; */
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    outline: none;
    tab-size: 2;
    white-space: pre;
  }
</style>
