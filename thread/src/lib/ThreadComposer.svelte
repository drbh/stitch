<!-- ThreadComposer.svelte -->
<script>
  import { createThread, isSidebarExpanded } from "./stores";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  let title = "";
  let creator = "";
  let initialPost = "";
  let imageFile = null;
  let imagePreview = null;
  let fileInput;
  let isPosting = false;
  let showComposer = false;

  function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      imageFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function clearForm() {
    title = "";
    creator = "";
    initialPost = "";
    imageFile = null;
    imagePreview = null;
    if (fileInput) fileInput.value = "";
    showComposer = false;
  }

  async function handleSubmit() {
    if (!title.trim() || !creator.trim() || !initialPost.trim()) return;

    await createThread(
      title,
      creator,
      initialPost,
      imageFile,
      () => {
        isPosting = true;
      },
      () => {
        isPosting = false;
        clearForm();
        dispatch("posted");
      }
    );
  }

  let isCreating = false;
</script>

<section class="thread-container">
  <div class="thread-header">
    {#if $isSidebarExpanded}
      <h2>Threads</h2>
      <button
        class="create-btn"
        on:click={() => (showComposer = !showComposer)}
      >
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
        New Thread
      </button>
    {/if}
  </div>

  <div class="thread-composer">
    {#if showComposer}
      <!-- <button class="start-thread" on:click={() => (showComposer = true)}>
      Start New Discussion
    </button> -->
      <div class="composer-form">
        <input
          type="text"
          placeholder="Thread Title"
          bind:value={title}
          disabled={isPosting}
        />

        <input
          type="text"
          placeholder="Your Name"
          bind:value={creator}
          disabled={isPosting}
        />

        <textarea
          placeholder="Write your initial post..."
          bind:value={initialPost}
          disabled={isPosting}
        />

        <div class="image-upload">
          <input
            type="file"
            accept="image/*"
            on:change={handleImageSelect}
            bind:this={fileInput}
            disabled={isPosting}
          />

          {#if imagePreview}
            <div class="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                class="remove-image"
                on:click={() => {
                  imageFile = null;
                  imagePreview = null;
                  fileInput.value = "";
                }}
              >
                Remove Image
              </button>
            </div>
          {/if}
        </div>

        <div class="actions">
          <button class="cancel" on:click={clearForm} disabled={isPosting}>
            Cancel
          </button>
          <button
            class="submit"
            on:click={handleSubmit}
            disabled={isPosting ||
              !title.trim() ||
              !creator.trim() ||
              !initialPost.trim()}
          >
            {isPosting ? "Posting..." : "Post Thread"}
          </button>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .thread-container {
    display: flex;
    flex-direction: column;
    gap: var(--space);

    border-right: 1px solid var(--border);
  }

  .thread-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 30px;

    padding: var(--space);
  }

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

  .thread-composer {
    margin-bottom: var(--space);
  }

  .start-thread {
    width: 100%;
    padding: var(--space);
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    /* font-size: 1rem; */
    transition: opacity 0.2s ease;
  }

  .start-thread:hover {
    opacity: 0.9;
  }

  .composer-form {
    background: var(--card);
    padding: var(--space);
    border-radius: var(--radius);
  }

  input,
  textarea {
    width: 100%;
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--muted);
    border-radius: calc(var(--radius) / 2);
    background: var(--bg);
    color: var(--text);
    /* font-size: 1rem; */
  }

  textarea {
    min-height: 120px;
    resize: vertical;
  }

  .image-preview {
    margin: 12px 0;
  }

  .image-preview img {
    max-width: 100%;
    max-height: 300px;
    border-radius: calc(var(--radius) / 2);
  }

  .actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  button {
    padding: 8px 16px;
    border: none;
    border-radius: calc(var(--radius) / 2);
    cursor: pointer;
    /* font-size: 0.9rem; */
    transition: opacity 0.2s ease;
  }

  button:hover:not(:disabled) {
    opacity: 0.9;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cancel {
    background: var(--muted);
    color: var(--text);
  }

  .submit {
    background: var(--primary);
    color: white;
  }

  .remove-image {
    margin-top: 8px;
    background: var(--close-red);
    color: white;
  }
</style>
