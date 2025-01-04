<script>
  import { onMount } from "svelte";
  import DocumentGrid from "./lib/DocumentGrid.svelte";
  import PostComposer from "./lib/PostComposer.svelte";
  import ThreadList from "./lib/ThreadList.svelte";
  import ThreadComposer from "./lib/ThreadComposer.svelte";
  import DocumentPanel from "./lib/DocumentPanel.svelte";
  import { activeDocument, activeThread, panelWidth } from "./lib/stores";
  import Thread from "./lib/Thread.svelte";
  import Topbar from "./lib/Topbar.svelte";

  let mainContainer;

  onMount(() => {
    const handleKeydown = (e) => {
      if (e.key === "Escape") {
        activeDocument.set(null);
        activeThread.set(null);
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<Topbar />

<div
  class="layout-container"
  class:panel-open={$activeDocument}
  bind:this={mainContainer}
  style="--current-panel-width: {$panelWidth}px"
>
  <div class="two-column-grid">
    <div class="left-column">
      <ThreadComposer />
      <ThreadList />
    </div>
    <div class="right-column">
      <DocumentGrid />
      <PostComposer />
      <Thread />
    </div>
  </div>
</div>
<DocumentPanel />

<style>
  :global(:root) {
    --primary: #00bd9d;
    --secondary: color-mix(
      in hsl,
      var(--primary),
      hsl(from var(--primary) calc(h + 185) s l)
    );
    --bg: #111;
    --card: #1a1a1a;
    --border: #333;
    --text: #8b8b8b;
    --muted: #888;
    --radius: 1px;
    --space: 15px;
    --panel-width: 600px;
    --header-height: 60px;
    --column-gap: 0.5rem;
    --close-red: #3f2e2e;
    --font-family: "IBM Plex Mono", serif;

    textarea {
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
    }
  }

  :global(body.dragging) {
    user-select: none;
    cursor: col-resize;
  }

  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: var(--bg);
    color: var(--text);
    font-size: 12pt;
    font-family: var(--font-family);
    overflow-x: hidden;
  }

  .layout-container {
    max-width: 1200px;
    margin: 0 0;
    padding: 0 0;
  }

  .left-column {
    max-width: 40%;
  }

  .panel-open {
    margin-right: min(var(--current-panel-width), 70%);
  }

  .two-column-grid {
    display: flex;
    gap: var(--column-gap);
    width: 100%;
  }

  .left-column,
  .right-column {
    min-width: 0;
  }

  .right-column {
    /* min-width: 500px; */
  }

  @media (max-width: 768px) {
    .two-column-grid {
      flex-direction: column;
    }

    .left-column,
    .right-column {
      width: 100%;
    }

    .left-column {
      max-width: 90%;
    }

    .panel-open {
      margin-right: 0;
    }
  }
</style>
