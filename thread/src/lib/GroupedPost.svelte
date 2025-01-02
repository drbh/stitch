<!-- GroupedPost.svelte -->
<script>
  import { API_BASE } from "./stores";
  import { createEventDispatcher } from "svelte";
  import { marked } from "marked";

  export let posts = [];
  const dispatch = createEventDispatcher();

  const SIGNIFICANT_TIME_GAP = 5 * 60 * 1000; // 5 minutes in milliseconds

  function formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000;
    const days = Math.floor(diff / 86400);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (months < 12) return `${months}mo ago`;
    if (years === 1) return "1 year ago";
    return `${years} years ago`;
  }

  function formatTimeDiff(current, previous) {
    // console.log(current, previous);
    const diff = new Date(current) - new Date(previous);
    // console.log(diff);
    if (diff < SIGNIFICANT_TIME_GAP) return null;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} later`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} later`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} later`;
    return null;
  }

  function getDetailedTime(isoString) {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  $: sortedPosts = [...posts].sort(
    (a, b) => new Date(a.time) - new Date(b.time)
  );
</script>

<div class="group-card">
  <!-- Header only shown once for the group -->
  <div class="header">
    <div class="header-left">
      <div
        class="avatar {`avatar-${sortedPosts[0].author[0].toLowerCase()}`}"
      ></div>
      <div>
        <div>{sortedPosts[0].author}</div>
        <small
          class="initial-time"
          title={getDetailedTime(sortedPosts[0].time)}
        >
          <!-- {formatTime(sortedPosts[0].time)} -->
          {sortedPosts[0].time}
        </small>
      </div>
    </div>
  </div>

  <!-- Posts content -->
  <div class="posts-container">
    {#each sortedPosts as post, index (post.id)}
      {#if index < sortedPosts.length - 1}
        {@const timeDiff = formatTimeDiff(
          sortedPosts[index + 1].time,
          post.time
        )}
        {#if timeDiff}
          <div class="time-gap">{timeDiff}</div>
        {/if}
      {/if}
      <div class="post-content">
        <div class="text-content">{@html marked(post.text)}</div>

        {#if post.image}
          <img
            src="{API_BASE}{post.image}"
            alt="Post image"
            class="post-image"
          />
        {/if}

        <div class="post-footer">
          <small class="timestamp" title={getDetailedTime(post.time)}>
            {formatTime(post.time)}
            {post.time}
          </small>
          {#if post.edited}
            <span class="edited">Edited</span>
          {/if}
          <button
            class="delete"
            on:click={() => dispatch("delete", { id: post.id })}
            aria-label="Delete post"
          >
            ×
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .group-card {
    border-radius: var(--radius);
    margin-bottom: calc(var(--space) / 2);
    border: 1px solid var(--border);
    animation: fadeIn 0.3s;
  }

  /* .group-card:hover {
    border-color: var(--primary);
  } */

  .header {
    padding: calc(var(--space) / 4) calc(var(--space) / 2);
    border-bottom: 1px solid var(--muted);
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
  }

  .avatar-s {
    background: var(--secondary);
  }

  .initial-time {
    color: var(--muted);
    font-size: 0.85em;
  }

  .posts-container {
    display: flex;
    flex-direction: column;
  }

  .time-gap {
    padding: calc(var(--space) / 6) calc(var(--space) / 2);
    color: var(--muted);
    font-size: 0.85em;
    background: rgba(var(--muted-rgb), 0.05);
    text-align: center;
    /* font-style: italic; */
  }

  .post-content {
    padding: calc(var(--space) / 4) calc(var(--space) / 2);
    position: relative;
  }

  .post-content:not(:last-child) {
    border-bottom: 1px solid rgba(var(--muted-rgb), 0.1);
  }

  .text-content {
    text-align: justify;
    margin-bottom: 4px;
  }

  .text-content :global(p) {
    margin: 0;
  }

  .post-image {
    width: 100%;
    border-radius: calc(var(--radius) / 2);
    margin: 4px 0;
    max-width: 200px;
  }

  .post-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 0.8em;
  }

  .timestamp {
    color: var(--muted);
  }

  .edited {
    color: var(--muted);
    font-style: italic;
  }

  .delete {
    color: var(--close-red);
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    margin-left: auto;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .post-content:hover .delete {
    opacity: 1;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
