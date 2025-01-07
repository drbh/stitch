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

  // Helper function to get ISO week number
  function getISOWeek(date) {
    const target = new Date(date);
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
  }

  function createActivityChart(posts) {
    const now = new Date();
    // if now is not a Saturday, add empty cells to fill the week and remove that number of days from the end
    const daysToFill = 6 - now.getDay();
    now.setDate(now.getDate() + daysToFill);

    const weeks = 52;
    const msPerDay = 24 * 60 * 60 * 1000;

    // Initialize the grid with 7 rows (days) and 52 columns (weeks)
    const grid = Array.from({ length: 7 }, () =>
      Array.from({ length: weeks }, () => ({
        date: null,
        count: 0,
        weekDay: 0,
        dayOfWeek: 0,
        weekOfYear: 0,
      }))
    );

    // Fill the grid with dates and initialize counts
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < 7; day++) {
        const daysAgo = (weeks - 1 - week) * 7 + (6 - day);
        const date = new Date(now - daysAgo * msPerDay);

        grid[day][week] = {
          date,
          count: 0,
          weekDay: date.getDay(),
          dayOfWeek: day,
          weekOfYear: getISOWeek(date),
        };
      }
    }

    // Count posts for each day
    posts.forEach((post) => {
      const postDate = new Date(post.time);
      const daysAgo = Math.floor((now - postDate) / msPerDay);

      if (daysAgo < weeks * 7) {
        const week = Math.floor((weeks * 7 - 1 - daysAgo) / 7);
        const day = postDate.getDay(); // + 4;

        if (week >= 0 && week < weeks && grid[day][week]) {
          grid[day][week].count++;
        }
      }
    });

    return grid.flat();
  }

  function updateActivityChart() {
    activityData = createActivityChart($posts);
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
      <!-- svelte-ignore element_invalid_self_closing_tag -->
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
