<script>
  import { onMount } from "svelte";
  import DocumentGrid from "./lib/DocumentGrid.svelte";
  import PostComposer from "./lib/PostComposer.svelte";
  import ThreadList from "./lib/ThreadList.svelte";
  import ThreadComposer from "./lib/ThreadComposer.svelte";
  import DocumentPanel from "./lib/DocumentPanel.svelte";
  import {
    documents,
    activeDocument,
    activeThread,
    panelWidth,
    isSidebarExpanded,
  } from "./lib/stores";
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
    --primary: #9c7a43;
    /* --primary: #083f2d; */
    /* --primary: #b35f04; */
    /* --primary: #b35f04; */
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
    /* --close-red: #ff4444; */
    --close-red: #3f2e2e;
    /* --font-family: "Reddit Mono", serif; */
    /* --font-family: "Sono", serif; */
    --font-family: "IBM Plex Mono", serif;

    textarea {
      /* or whatever container element you're using */
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
    /* font-family: system-ui, sans-serif; */
    /* font-family: "Doto", serif; */
    /* font-family: "Reddit Mono", serif; */
    /* font-size: 9pt; */
    font-size: 12pt;
    /* line-height: 1.5; */
    font-family: var(--font-family);
    /* line-height: 0.95; */
    /* padding: var(--space); */
    overflow-x: hidden;
  }

  .layout-container {
    max-width: 1200px;
    /* margin: 0 auto; */
    margin: 0 0;
    /* transition: all 0.3s ease; */
    padding: 0 0;
  }

  .left-column {
    max-width: 40%;

    /* z-index: 9; */
    /* background-color: red; */
    /* width: 100%; */
  }

  .panel-open {
    /* margin-right: var(--panel-width); */
    /* margin-right: min(var(--panel-width), 50%); */
    /* max-width: calc(1200px - var(--panel-width)); */
    /* margin-right: var(--current-panel-width); */
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
