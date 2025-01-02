<script>
  import { onMount, onDestroy } from "svelte";

  export let config = {
    showTimeZones: true,
    showMetrics: true,
    refreshRate: 1000,
    timeFormat: "24h",
    currentCountry: "US",
  };

  const timeZones = [
    { id: "UTC", name: "UTC", zone: "UTC" },
    { id: "EST", name: "Eastern", zone: "America/New_York" },
    { id: "PST", name: "Pacific", zone: "America/Los_Angeles" },
    { id: "ECT", name: "Central Europe", zone: "Europe/Paris" },
    { id: "JST", name: "Japan", zone: "Asia/Tokyo" },
    { id: "AEDT", name: "Australia East", zone: "Australia/Sydney" },
  ].sort((a, b) => getOffset(b.zone) - getOffset(a.zone));

  const countryFlags = {
    US: "US",
    GB: "GB",
    FR: "FR",
    DE: "DE",
    IT: "IT",
    ES: "ES",
    JP: "JP",
    AU: "AU",
  };

  let times = {
    zones: {},
    week: 0,
    dayOfYear: 0,
    current: "",
  };

  function getOffset(timezone) {
    return -new Date()
      .toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
        timeZoneName: "shortOffset",
      })
      .slice(-6)
      .replace("GMT", "")
      .replace(":", ".");
  }

  function updateTimes() {
    const now = new Date();
    const format = {
      hour12: config.timeFormat === "12h",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };

    // Update time zones
    times.zones = Object.fromEntries(
      timeZones.map((tz) => [
        tz.id,
        now.toLocaleTimeString("en-US", { timeZone: tz.zone, ...format }),
      ])
    );

    // Update current time
    times.current = now.toLocaleTimeString("en-US", format);

    // Update metrics
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    times.week = Math.ceil(
      ((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
    );
    times.dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  }

  let interval;
  onMount(() => {
    updateTimes();
    interval = setInterval(updateTimes, config.refreshRate);
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  let touchStartX = 0;
  let currentIndex = 0;
  let isPanning = false;
  let panOffset = 0;

  // Calculate total pages (TimeZones + Metrics)
  const totalPages = timeZones.length + (config.showMetrics ? 1 : 0);

  function handleTouchStart(e) {
    console.log("touch start");
    touchStartX = e.touches[0].clientX;
    isPanning = true;
  }

  function handleTouchMove(e) {
    if (!isPanning) return;

    const touchCurrentX = e.touches[0].clientX;
    const diff = touchCurrentX - touchStartX;
    panOffset = diff;
  }

  function handleTouchEnd() {
    if (!isPanning) return;

    const threshold = window.innerWidth * 0.2; // 20% of screen width

    if (Math.abs(panOffset) > threshold) {
      if (panOffset > 0 && currentIndex > 0) {
        currentIndex--;
      } else if (panOffset < 0 && currentIndex < totalPages - 1) {
        currentIndex++;
      }
    }

    isPanning = false;
    panOffset = 0;
  }

  function loopThroughTimeZones() {
    if (currentIndex === totalPages - 1) {
      currentIndex = 0;
    } else {
      currentIndex++;
    }
  }

  let showFull = false;

  onMount(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (e) => {
      showFull = !e.matches;
    };

    handleMediaChange(mediaQuery);
    mediaQuery.addEventListener("change", handleMediaChange);
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- on desktop and mobile -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="top-bar">
  {#if showFull}
    {#if config.showTimeZones}
      <div class="time-zones">
        {#each timeZones as zone}
          <div class="time-block">
            <h2>{zone.name}</h2>
            <span>{times.zones[zone.id]}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if config.showMetrics}
    <div class="metrics">
      <div class="time-block">
        <h2>Week</h2>
        <span>{times.week}</span>
      </div>
      <div class="time-block">
        <h2>Day</h2>
        <span>{times.dayOfYear}</span>
      </div>
    </div>
  {/if}

  {#if !showFull}
    <div
      class="time-carousel"
      on:click={loopThroughTimeZones}
      on:touchstart={handleTouchStart}
      on:touchmove={handleTouchMove}
      on:touchend={handleTouchEnd}
    >
      <div class="carousel-wrapper">
        <div class="carousel-container">
          <div
            class="carousel"
            style="transform: translateX(calc({-currentIndex *
              100}% + {panOffset}px))"
          >
            {#each timeZones as zone}
              <div
                class="time-card"
                class:active={timeZones.indexOf(zone) === currentIndex}
              >
                <h2>{zone.name}</h2>
                <span class="time">{times.zones[zone.id]}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>

      <div class="indicators">
        {#each Array(totalPages) as _, i}
          <div
            class="dot"
            on:click={(e) => {
              e.stopPropagation();
              currentIndex = i;
            }}
            class:active={i === currentIndex}
          ></div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="current-time">
    <span class="flag">{countryFlags[config.currentCountry] || "🏳️"}</span>
    <span class="clock">{times.current}</span>
  </div>
</div>

<style>
  .top-bar {
    display: grid;
    grid-template-columns: auto auto auto;
    gap: calc(var(--space) / 2);
    padding: calc(var(--space) / 4);
    /* margin-bottom: calc(var(--space) / 1); */
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    align-items: center;
    height: auto;
    min-height: 50px;
    width: 100%;

    touch-action: pan-x;
  }

  .carousel-wrapper {
    width: 130px;
    gap: 0.5rem;
    padding: 0.75rem;
  }

  .carousel-container {
    width: 100%;
    overflow: hidden;
    position: relative;
  }

  .carousel {
    display: flex;
    transition: transform 0.3s ease-out;
    width: 100%;
  }

  .time-card {
    min-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  .time-card.active {
    opacity: 1;
  }

  .time-zones {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .metrics {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .time-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .current-time {
    display: flex;
    align-items: center;
    gap: calc(var(--space) / 2);
    justify-content: flex-end;
  }

  h2 {
    font-size: 0.7rem;
    font-weight: 500;
    margin: 0;
    opacity: 0.7;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  span {
    /* font-family: "JetBrains Mono", monospace; */
    font-size: 0.9rem;
    font-weight: 500;
    min-width: 75px;
    text-align: center;
  }

  .flag {
    font-size: 1.2rem;
    min-width: auto;
  }

  .indicators {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0px 1.5rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--secondary);
    background: rgba(255, 255, 255, 0.3);
    /* transition: background-color 0.3s ease; */
    transition: background-color 0.3s ease;
    filter: brightness(0.5);
  }

  .dot.active {
    /* background: rgba(255, 255, 255, 0.8); */
    background-color: var(--primary);
    filter: brightness(1.5);
  }

  .dot:hover {
    /* background: var(--secondary); */
    background-color: var(--primary);
  }

  @media (max-width: 768px) {
    .top-bar {
      display: flex;
    }

    .time-zones,
    .metrics {
      /* justify-content: center; */
      max-height: 60px;
      overflow: hidden;
      /* overflow-x: auto; */
      gap: 0px;
    }

    .current-time {
      /* justify-content: start; */
    }
  }
</style>
