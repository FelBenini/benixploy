<script lang="ts">
  import { cn } from "$lib/utils.js";

  let {
    class: className,
    rows: propRows,
    cols: propCols,
  }: {
    class?: string;
    rows?: number;
    cols?: number;
  } = $props();

  let rows = $state(8);
  let cols = $state(8);

  $effect(() => {
    function compute() {
      if (propRows != null && propCols != null) {
        rows = propRows;
        cols = propCols;
        return;
      }
      const w = window.innerWidth;
      const h = window.innerHeight;
      const size = w >= 640 ? 64 : 56;
      if (propCols == null) rows = Math.ceil(w / size) + 1;
      if (propRows == null) cols = Math.ceil(h / size) + 1;
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  });

  let rowArr = $derived(Array.from({ length: rows }));
  let colArr = $derived(Array.from({ length: cols }));
</script>

<div
  class={cn(
    "absolute inset-0 z-0 flex items-center justify-center overflow-hidden",
    className,
  )}
>
  <div class="flex">
    {#each rowArr as _, i (i)}
      <div class="flex flex-col">
        {#each colArr as _, j (j)}
          <div
            class="size-14 sm:size-16 border-r border-t border-foreground/[0.04] transition-colors duration-300 hover:bg-primary/[0.06]"
            class:border-l={i === 0}
            class:border-b={j === cols - 1}
          ></div>
        {/each}
      </div>
    {/each}
  </div>
</div>
