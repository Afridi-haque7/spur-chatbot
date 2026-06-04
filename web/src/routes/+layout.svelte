<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(:root) {
    --accent: #4f46e5;
    --surface: #ffffff;
    --bg-muted: #f6f7f9;
    --border: #e5e7eb;
    --text-muted: #6b7280;
    --ai-bubble: #ffffff;
    --ai-text: #1f2933;
  }
  :global(body) {
    margin: 0;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
      sans-serif;
    color: var(--ai-text);
  }
  :global(*) {
    box-sizing: border-box;
  }
</style>
