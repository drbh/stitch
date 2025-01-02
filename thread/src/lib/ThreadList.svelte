<!-- ThreadList.svelte -->
<script>
  import { onMount } from "svelte";
  import {
    threads,
    activeThread,
    fetchThread,
    deleteThread,
    isSidebarExpanded,
  } from "./stores";

  function formatDistance(date) {
    return date;
  }

  function handleThreadClick(threadId) {
    fetchThread(threadId);
  }

  let threadContainer = null;
  let AUTO_COLLAPSE_WIDTH = 360;
  let autoClose = false;

  onMount(() => {
    // listen for any resize events on the thread container
    const resizeObserver = new ResizeObserver(() => {
      let shouldCollapse = threadContainer.clientWidth < AUTO_COLLAPSE_WIDTH;
      console.log(
        "resize",
        threadContainer.clientWidth,
        autoClose,
        shouldCollapse
      );

      if (autoClose && shouldCollapse) {
        isSidebarExpanded.set(false);
      }
    });

    resizeObserver.observe(threadContainer);
  });

  const toggleButton = () => {
    // dont allow open if the total window width is less than 600px
    // if (window.innerWidth < 800) return;

    // autoClose = false;
    isSidebarExpanded.set(!$isSidebarExpanded);
    // setTimeout(() => {
    //   autoClose = true;
    // }, 300);
  };
</script>

<div
  class="thread-container"
  class:collapsed={!$isSidebarExpanded}
  bind:this={threadContainer}
>
  <button
    class="toggle-btn"
    on:click={toggleButton}
    aria-label={$isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
  >
    <svg
      class="chevron"
      class:rotated={!$isSidebarExpanded}
      viewBox="0 0 24 24"
      width="24"
      height="24"
    >
      <path
        d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"
        fill="currentColor"
      />
    </svg>
  </button>

  <div class="thread-list" class:collapsed={!$isSidebarExpanded}>
    {#if $threads.length === 0}
      <div class="card">
        <h3>No threads yet</h3>
        <p>Start a new thread by clicking the button above.</p>
      </div>
    {:else}
      {#each $threads as thread}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <article
          class="thread-card"
          class:active={$activeThread?.id === thread.id}
          on:click={() => handleThreadClick(thread.id)}
        >
          <header class="card-header">
            <div class="title-group">
              <div class="title">{thread.title}</div>
              {#if $isSidebarExpanded}
                <div class="meta-info">
                  <span class="creator">By {thread.creator}</span>
                  <span class="dot">•</span>
                  <time class="timestamp">
                    {thread.last_activity}
                  </time>
                </div>
              {/if}
            </div>

            {#if $isSidebarExpanded}
              <button
                class="delete-btn"
                on:click={(e) => {
                  if (!confirm("Delete this Thread?")) return;
                  deleteThread(thread.id);
                  e.stopPropagation();
                }}
                aria-label="Delete thread"
              >
                ×
              </button>
            {/if}
          </header>

          {#if $isSidebarExpanded}
            <footer class="card-footer">
              <div class="stats">
                <span>{thread.reply_count + 1} posts</span>
                <span class="dot">•</span>
                <span>{thread.view_count} views</span>
              </div>
            </footer>
          {/if}
        </article>
      {/each}
    {/if}
  </div>
</div>

<style>
  .thread-container {
    position: relative;
    display: flex;
  }

  .thread-container.collapsed .thread-list {
    width: 100px;
  }

  .thread-list {
    margin-bottom: var(--space);
    /* width: 300px; */
    width: 100%;
    overflow-x: hidden;
  }

  .toggle-btn {
    position: absolute;
    right: -12px;
    top: -40px;
    width: 24px;
    height: 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 50%;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: transform 0.3s ease;
  }

  .toggle-btn:hover {
    background: var(--primary);
    color: white;
  }

  .chevron {
    transition: transform 0.3s ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  .thread-card {
    border-radius: var(--radius);
    padding: calc(var(--space) / 2);
    margin-bottom: calc(var(--space) / 2);
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border: 1px solid var(--border);
  }

  .thread-card:hover {
    border: 1px solid var(--primary);
    filter: brightness(115%);
  }

  .thread-card.active {
    border: 1px solid var(--primary);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .title-group {
    flex: 1;
    min-width: 0;
  }

  .title {
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta-info {
    color: var(--muted);
    font-size: 0.9em;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .creator {
    color: var(--primary);
  }

  .delete-btn {
    color: var(--close-red);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.5em;
    line-height: 1;
    padding: 4px;
  }

  .card-footer {
    color: var(--muted);
    font-size: 0.85em;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dot {
    opacity: 0.5;
  }
</style>
