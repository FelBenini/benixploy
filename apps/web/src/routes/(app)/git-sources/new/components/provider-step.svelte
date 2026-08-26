<script lang="ts">
  import { cn } from "$lib/utils.js";

  let { onSelect }: { onSelect: (provider: string) => void } = $props();

  const providers = [
    {
      id: "github",
      label: "GitHub (App)",
      icon: "/git/github.png",
      disabled: false,
      note: "We create and install a GitHub App for you in a few clicks.",
      card: "bg-[radial-gradient(circle_at_top_left,_#24292f21_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#24292f10_0%,_transparent_60%)] hover:border-[#24292f]/50 hover:bg-[#24292f]/5",
      iconClass: "border-[#24292f]/20 bg-[#24292f]/10 text-[#24292f]",
    },
    {
      id: "gitlab",
      label: "GitLab",
      icon: "/git/gitlab.png",
      disabled: true,
      note: "Adapter ships in a follow-up.",
      card: "bg-[radial-gradient(circle_at_top_left,_#fc6d2621_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#fc6d2610_0%,_transparent_60%)] hover:border-[#fc6d26]/50 hover:bg-[#fc6d26]/5",
      iconClass: "border-[#fc6d26]/20 bg-[#fc6d26]/10 text-[#fc6d26]",
    },
    {
      id: "gitea",
      label: "Gitea",
      icon: "/git/gitea.png",
      disabled: true,
      note: "Adapter ships in a follow-up.",
      card: "bg-[radial-gradient(circle_at_top_left,_#60992621_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#60992610_0%,_transparent_60%)] hover:border-[#609926]/50 hover:bg-[#609926]/5",
      iconClass: "border-[#609926]/20 bg-[#609926]/10 text-[#609926]",
    },
    {
      id: "bitbucket",
      label: "Bitbucket",
      icon: "/git/bitbucket.png",
      disabled: true,
      note: "Adapter ships in a follow-up.",
      card: "bg-[radial-gradient(circle_at_top_left,_#0052cc21_0%,_transparent_60%),radial-gradient(circle_at_bottom_right,_#0052cc10_0%,_transparent_60%)] hover:border-[#0052cc]/50 hover:bg-[#0052cc]/5",
      iconClass: "border-[#0052cc]/20 bg-[#0052cc]/10 text-[#0052cc]",
    },
  ];
</script>

<div class="grid gap-1 py-3 sm:grid-cols-2">
  {#each providers as provider (provider.id)}
    <button
      type="button"
      disabled={provider.disabled}
      onclick={() => onSelect(provider.id)}
      class={cn(
        "group flex w-full cursor-pointer flex-col items-start justify-between gap-3 rounded border border-border bg-muted/20 p-4 text-left transition-colors",
        provider.card,
        provider.disabled && "cursor-not-allowed opacity-50",
      )}
    >
        <img
          src={provider.icon}
          class={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
            provider.iconClass,
          )}
          alt={`${provider.id}'s logo`}
        />
      <span class="text-foreground text-sm font-medium">{provider.label}</span>
      <span class="text-muted-foreground text-xs">{provider.note}</span>
    </button>
  {/each}
</div>
