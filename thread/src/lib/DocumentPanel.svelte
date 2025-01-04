<!-- components/DocumentPanel.svelte -->
<script>
  import {
    documents,
    activeDocument,
    updateDocument,
    panelWidth,
  } from "./stores";
  import { marked } from "marked";
  import DocumentEditor from "./DocumentEditor.svelte";
  import { spring } from "svelte/motion";
  // import DocumentEditorFull from "./DocumentEditorFull.svelte";

  export let minWidth = 300;
  // export let maxWidth = window.innerWidth * 0.8;
  export let maxWidth = window.innerWidth;

  let isDragging = false;
  let startX;
  let startWidth;

  function handleMousedown(e) {
    isDragging = true;
    startX = e.clientX;
    startWidth = $panelWidth;

    // Add dragging class to body
    document.body.classList.add("dragging");

    window.addEventListener("mousemove", handleMousemove);
    window.addEventListener("mouseup", handleMouseup);
  }

  function handleMousemove(e) {
    if (!isDragging) return;

    const delta = startX - e.clientX;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + delta));
    panelWidth.set(newWidth);
  }

  function handleMouseup() {
    isDragging = false;

    // Remove dragging class from body
    document.body.classList.remove("dragging");

    window.removeEventListener("mousemove", handleMousemove);
    window.removeEventListener("mouseup", handleMouseup);
  }

  let activeTab = "preview";
  let cursorPosition = { line: 1, column: 1 };
  let scrollTop = 0;

  function closePanel() {
    activeDocument.set(null);
  }

  function testFunction(docId, doc) {
    console.log(`Updating document ${docId}`, doc);
    updateDocument(doc, () => {
      console.log(`Document ${docId} updated`);
    });
  }

  let debouncedUpdate = debounce(testFunction, 1000);

  function handleEditorChange(event) {
    if (!currentDoc) return;

    debouncedUpdate(currentDoc.id, {
      ...currentDoc,
      content: event.detail.content,
    });

    documents.update((docs) => ({
      ...docs,
      [$activeDocument]: {
        ...currentDoc,
        content: event.detail.content,
      },
    }));
  }

  function debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  function handleCursorMove(event) {
    cursorPosition = event.detail;
  }

  function handleScroll(event) {
    scrollTop = event.detail.scrollTop;
  }

  $: currentDoc = $activeDocument ? $documents[$activeDocument] : null;
</script>

<div class="panel" class:open={$activeDocument} style="width: {$panelWidth}px">
  {#if $activeDocument}
    <div class="panel-header">
      <div class="resize-handle" on:mousedown={handleMousedown}></div>
      <div class="header-left">
        <div class="tab-group">
          <button
            class="tab-btn"
            class:active={activeTab === "edit"}
            on:click={() => (activeTab = "edit")}
          >
            Edit
          </button>
          <button
            class="tab-btn"
            class:active={activeTab === "preview"}
            on:click={() => (activeTab = "preview")}
          >
            Preview
          </button>
        </div>
        {#if activeTab === "edit"}
          <span class="cursor-position">
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
        {/if}
      </div>
      <button class="panel-close" on:click={closePanel}>×</button>
    </div>

    <div class="panel-content" class:preview-mode={activeTab === "preview"}>
      {#if currentDoc}
        {#if activeTab === "edit"}
          <DocumentEditor
            content={currentDoc.content}
            {cursorPosition}
            {scrollTop}
            on:change={handleEditorChange}
            on:cursorMove={handleCursorMove}
            on:scroll={handleScroll}
          />
        {:else if currentDoc.type === "text" || currentDoc.type === "code"}
          <div class="preview-content markdown-body">
            {@html marked(currentDoc.content)}
          </div>
        {:else if currentDoc.type === "table"}
          <table class="preview-table">
            {#each currentDoc.content.split("\n") as row, i}
              <tr>
                {#each row.split(",") as cell, j}
                  {#if i === 0}
                    <th>{cell.trim()}</th>
                  {:else}
                    <td>{cell.trim()}</td>
                  {/if}
                {/each}
              </tr>
            {/each}
          </table>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .panel {
    position: fixed;
    top: 0;
    right: calc(-1 * var(--panel-width));
    width: var(--panel-width);
    height: 100vh;
    background: var(--card);
    transition: right 0.3s ease;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border);
  }

  .panel.open {
    right: 0;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
  }

  .panel-header {
    height: var(--header-height);
    padding: 0 var(--space);
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .cursor-position {
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .tab-group {
    display: flex;
    gap: 1px;
    background: var(--border);
    padding: 2px;
    /* border-radius: 6px; */
    border-radius: 2px;
  }

  .tab-btn {
    background: var(--bg-dark);
    border: none;
    color: var(--text-muted);
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    /* border-radius: 4px; */
    border-radius: 1px;
  }

  .tab-btn:hover {
    color: var(--text);
  }

  .tab-btn.active {
    /* background: var(--bg-dark); */
    background: var(--bg);
    color: var(--text);
  }

  .panel-close {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 10px;
    font-size: 18px;
  }

  .panel-close:hover {
    color: var(--text-bright);
  }

  .panel-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg);
    display: flex;
    flex-direction: column;
  }

  .panel-content.preview-mode {
    padding: var(--space);
  }

  .preview-content {
    padding: var(--space);
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    margin: var(--space) 0;
  }

  .preview-table th,
  .preview-table td {
    padding: 8px 12px;
    border: 1px solid var(--border);
    text-align: left;
  }

  .preview-table th {
    background: var(--bg-dark);
  }

  .markdown-body {
    color: var(--text);
    line-height: 1.6;
  }

  .markdown-body h1,
  .markdown-body h2,
  .markdown-body h3,
  .markdown-body h4 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }

  .markdown-body code {
    background: var(--bg-dark);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
  }

  .markdown-body pre code {
    display: block;
    padding: 16px;
    overflow-x: auto;
  }

  .resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.2s;
  }

  .resize-handle:hover {
    background: var(--primary);
  }

  .panel-content {
    padding: var(--space);
  }

  /* Prevent text selection while dragging */
</style>
