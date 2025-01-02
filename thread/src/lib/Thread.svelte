<!-- Thread.svelte -->
<script>
  import { posts, removePost, togglePostLike, activeThread } from "./stores";
  import GroupedPost from "./GroupedPost.svelte";
  import { onMount } from "svelte";

  let activityData = [];
  let groupedPosts = [];

  onMount(() => {
    updateActivityChart();
  });

  $: if ($posts) {
    updateActivityChart();
    groupPosts($posts);
  }

  function groupPosts(posts) {
    // console.log("Grouping posts", posts);

    // sort in ascending order (by time)
    posts.sort((a, b) => new Date(a.time) - new Date(b.time));
    console.log(posts);

    groupedPosts = posts.reduce((groups, post, index, array) => {
      const prevPost = array[index - 1];
      const prevGroup = groups[groups.length - 1];
      // console.log(prevGroup, prevPost);

      // Check if this post should be part of the previous group
      if (
        prevGroup &&
        prevPost &&
        post.author === prevPost.author &&
        new Date(post.time) - new Date(prevPost.time) < 1800000
      ) {
        // 30 minutes in milliseconds
        prevGroup.push(post);
      } else {
        groups.push([post]);
      }

      return groups;
    }, []);
  }

  function updateActivityChart() {
    const now = Date.now();
    const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const msPerDay = 24 * 60 * 60 * 1000;

    activityData = Array.from({ length: 52 * 7 }, (_, i) => {
      const date = now - (52 * 7 - 1 - i) * msPerDay;
      return {
        date,
        count: $posts.filter((post) => {
          const postDay = Math.floor(post.time / msPerDay);
          const cellDay = Math.floor(date / msPerDay);
          return postDay === cellDay;
        }).length,
      };
    });
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  async function deletePost(event) {
    const { id } = event.detail;
    if (!confirm("Delete this post?")) return;
    try {
      await removePost(id);
    } catch (error) {
      alert("Failed to delete post. Please try again.");
    }
  }

  async function handleToggleLike(event) {
    const { post } = event.detail;
    try {
      await togglePostLike(post);
    } catch (error) {
      alert("Failed to update like status. Please try again.");
    }
  }
</script>

{#if $activeThread}
  <div class="activity-chart">
    {#each activityData as data}
      <div
        class="activity-cell"
        class:empty={data.count === 0}
        style="--activity: {Math.min(data.count / 5, 1)}"
        title={`${data.count || "No"} post${data.count !== 1 ? "s" : ""} on ${formatDate(data.date)}`}
      />
    {/each}
  </div>

  {#if $posts.length === 0}
    <div class="card">
      <h3>No posts yet</h3>
      <p>Be the first to post something!</p>
    </div>
  {:else}
    {#each groupedPosts as postGroup}
      <GroupedPost
        posts={postGroup}
        on:delete={deletePost}
        on:toggleLike={handleToggleLike}
      />
    {/each}
  {/if}
{/if}

<style>
  .activity-chart {
    display: grid;
    grid-template-columns: repeat(52, 1fr);
    grid-template-rows: repeat(7, 1fr);
    gap: 2px;
    padding: var(--space);
    background: var(--card);
    border-radius: var(--radius);
    margin-bottom: var(--space);
  }

  .activity-cell {
    aspect-ratio: 1;
    background: color-mix(
      in srgb,
      var(--primary) calc(var(--activity) * 100%),
      transparent
    );
    border-radius: 2px;
  }

  .activity-cell.empty {
    background: var(--muted);
    opacity: 0.1;
  }

  .card {
    background: var(--card);
    padding: var(--space);
    border-radius: var(--radius);
    margin-bottom: var(--space);
    text-align: center;
  }

  .card h3 {
    margin-bottom: 0.5em;
  }

  .card p {
    color: var(--muted);
  }
</style>
