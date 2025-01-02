<!-- DocumentGrid.svelte -->
<script>
  import {
    documents,
    activeDocument,
    createDocument as CD,
    removeDocument,
    activeThread,
  } from "./stores";
  import { createEventDispatcher } from "svelte";

  let isCreating = false;
  let newDoc = {
    title: "",
    content: "",
    type: "text",
  };

  const dispatch = createEventDispatcher();

  function openDocument(docId) {
    activeDocument.set(docId);
  }

  async function createDocument() {
    CD(newDoc, $activeThread.id, () => {
      isCreating = false;
    });
  }

  // async function createDocument() {
  //   if (!newDoc.title.trim()) return;

  //   try {
  //     const response = await fetch(`${API_BASE}/documents`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify({
  //         id: newDoc.title.toLowerCase().replace(/\s+/g, '-'),
  //         ...newDoc
  //       })
  //     });

  //     if (!response.ok) throw new Error('Failed to create document');

  //     const doc = await response.json();
  //     documents.update(docs => ({
  //       ...docs,
  //       [doc.id]: doc
  //     }));

  //     // Reset form
  //     newDoc = {
  //       title: "",
  //       content: "",
  //       type: "text"
  //     };
  //     isCreating = false;
  //   } catch (error) {
  //     console.error('Error creating document:', error);
  //     alert('Failed to create document. Please try again.');
  //   }
  // }

  function getDocumentIcon(type, id) {
    if (id === "guidelines") return "📌";
    switch (type) {
      case "text":
        return "📄";
      case "code":
        return "💻";
      case "table":
        return "📊";
      default:
        return "📄";
    }
  }

  function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }
</script>

{#if $activeThread}
  <section class="docs-container">
    <div class="docs-header">
      <h2>Documents</h2>
      <button class="create-btn" on:click={() => (isCreating = !isCreating)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Document
      </button>
    </div>

    {#if isCreating}
      <div class="create-form">
        <input
          type="text"
          bind:value={newDoc.title}
          placeholder="Document title"
          class="input"
        />
        <select bind:value={newDoc.type} class="input">
          <option value="text">Text Document</option>
          <option value="code">Code File</option>
          <option value="table">Spreadsheet</option>
        </select>
        <textarea
          bind:value={newDoc.content}
          placeholder="Initial content"
          class="input"
        ></textarea>
        <div class="form-actions">
          <button class="cancel-btn" on:click={() => (isCreating = false)}>
            Cancel
          </button>
          <button
            class="create-btn"
            on:click={createDocument}
            disabled={!newDoc.title.trim()}
          >
            Create
          </button>
        </div>
      </div>
    {/if}

    <div class="docs-grid">
      {#each Object.entries($documents) as [id, doc]}
        <div
          class="doc-card"
          class:active={$activeDocument === id}
          on:click={() => openDocument(id)}
        >
          <div class="doc-icon">
            {getDocumentIcon(doc.type, id)}
          </div>
          <div class="doc-info">
            <div class="header">
              <div class="header-left"></div>
              <button
                class="delete"
                on:click={(e) => {
                  if (!confirm("Delete this Document?")) return;
                  dispatch("delete");
                  e.stopPropagation();
                  removeDocument(doc.id);
                }}
                aria-label="Delete post"
              >
                ×
              </button>
            </div>

            <div>{doc.title}</div>
            <div>
              {#if id === "guidelines"}
                Pinned • {formatDate(doc.updated_at)}
              {:else}
                {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)} •
                {formatDate(doc.updated_at)}
                {#if doc.view_count > 0}
                  • {doc.view_count} views
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}

<style>
  .docs-container {
    display: flex;
    flex-direction: column;
    gap: calc(var(--space) / 2);
  }

  .docs-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: calc(var(--space) / 2);
    margin-bottom: calc(var(--space) / 2);
  }

  .doc-card {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: calc(var(--space) / 2);
    /* background: var(--card); */
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid var(--border);
  }

  .doc-card:hover {
    border: 1px solid var(--primary);
    filter: brightness(115%);
    transition: transform 0.3s;
  }

  .doc-card.active {
    /* background: #222; */
    border: 1px solid var(--primary);
  }

  .doc-icon {
    /* font-size: 24px; */
  }

  .doc-info h3 {
    /* font-size: 16px; */
    margin-bottom: 4px;
  }

  .doc-info p {
    /* font-size: 14px; */
    color: var(--muted);
  }

  /* last doc info in each card should have 100% width */
  .doc-info:last-child {
    width: 100%;
  }

  /* .create-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--primary);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: var(--radius);
    cursor: pointer;
  } */

  .create-btn {
    display: flex;
    align-items: center;
    gap: calc(var(--space) / 4);
    /* background: var(--primary); */
    background: none;
    border: 1px solid var(--primary);
    /* color: var(--text); */
    color: var(--primary);
    padding: calc(var(--space) / 4) calc(var(--space) / 2);
    border-radius: var(--radius);
    cursor: pointer;
    /* font-size: 14px; */
  }

  .create-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid #444;
    color: var(--text);
    padding: 8px 16px;
    border-radius: var(--radius);
    cursor: pointer;
    /* font-size: 14px; */
  }

  .create-form {
    background: var(--card);
    padding: var(--space);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .input {
    background: var(--bg);
    border: 1px solid #333;
    color: var(--text);
    padding: 8px 12px;
    border-radius: var(--radius);
    /* font-size: 14px; */
  }

  textarea.input {
    min-height: 100px;
    resize: vertical;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 8px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .delete {
    /* font-size: 24px; */
    color: var(--close-red);
    background: none;
    border: none;
    cursor: pointer;
  }
</style>
