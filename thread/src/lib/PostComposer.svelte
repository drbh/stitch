<!-- PostComposer.svelte -->
<script>
  import { posts, createPost, activeThread } from "./stores";
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();

  let text = "";
  let charCount = 0;
  let isPosting = false;
  let imageFile = null;
  let imagePreview = null;
  let fileInput;

  $: isValid = text.trim().length > 0 && text.length <= 280;

  function handleInput(e) {
    text = e.target.value;
    charCount = text.length;
  }

  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
      imageFile = file;
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function removeImage() {
    imageFile = null;
    imagePreview = null;
    if (fileInput) {
      fileInput.value = "";
    }
  }

  async function post() {
    createPost(
      $activeThread.id,
      text,
      imageFile,
      () => {
        if (!isValid) return;
        isPosting = true;
      },
      () => {
        // Reset form
        text = "";
        charCount = 0;
        imageFile = null;
        imagePreview = null;
        if (fileInput) {
          fileInput.value = "";
        }

        dispatch("posted");
      }
    );
  }

  function handleKeydown(e) {
    if (e.key === "Enter" && e.ctrlKey && isValid) {
      post();
    }
  }
</script>

{#if $activeThread}
  <div class="card">
    <div class="header">
      <div class="header-left">
        <div class="avatar"></div>
        <div>Create Post</div>
      </div>
    </div>

    <textarea
      bind:value={text}
      on:input={handleInput}
      on:keydown={handleKeydown}
      placeholder="What's on your mind?"
      maxlength="280"
      aria-label="Post content"
    />

    {#if imagePreview}
      <div class="image-preview">
        <img src={imagePreview} alt="Upload preview" />
        <button class="remove-image" on:click={removeImage}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    {/if}

    <div class="footer">
      <div class="actions">
        <div class="char-count">
          {charCount}/280
        </div>
        <label class="image-upload">
          <input
            type="file"
            accept="image/*"
            on:change={handleImageSelect}
            bind:this={fileInput}
            hidden
          />
          <button class="icon-button" type="button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              on:click={() => fileInput.click()}
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </button>
        </label>
      </div>
      <button
        class="create-btn"
        on:click={post}
        disabled={!isValid || isPosting}
      >
        {isPosting ? "Posting..." : "Post"}
      </button>
    </div>
  </div>
{/if}

<style>
  .card {
    /* background: var(--card); */
    padding: calc(var(--space) / 2);
    border-radius: var(--radius);
    margin-bottom: calc(var(--space) / 2);
    border: 1px solid var(--border);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* margin-bottom: 15px; */
    margin-bottom: calc(var(--space) / 2);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--primary);
    display: grid;
    place-items: center;
    font-weight: bold;
  }

  textarea {
    width: 100%;
    min-height: 100px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid #333;
    border-radius: var(--radius);
    padding: 15px;
    font-family: inherit;
    /* font-size: 16px; */
    resize: none;
    outline: 1px solid transparent;
  }

  textarea:focus {
    outline: 1px solid var(--primary);
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* margin-top: 15px; */
    margin-top: calc(var(--space) / 2);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .button {
    background: var(--primary);
    color: var(--text);
    border: none;
    border-radius: var(--radius);
    padding: 10px 20px;
    cursor: pointer;
  }

  .button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .icon-button {
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    padding: 8px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }

  .icon-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .image-preview {
    position: relative;
    margin-top: 15px;
    border-radius: var(--radius);
    overflow: hidden;
  }

  .image-preview img {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
  }

  .remove-image {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .remove-image:hover {
    background: rgba(0, 0, 0, 0.7);
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

  @media (max-width: 768px) {
    input,
    select,
    textarea {
      font-size: 16px !important;
      max-height: none;
      -webkit-text-size-adjust: none;
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  }
</style>
