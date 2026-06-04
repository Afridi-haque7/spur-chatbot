<script lang="ts">
  import type { Sender } from '$lib/types';

  let {
    sender,
    text,
    error = false,
  }: { sender: Sender; text: string; error?: boolean } = $props();

  const isUser = $derived(sender === 'user');
</script>

<div class="row" class:user={isUser}>
  <div class="bubble" class:user={isUser} class:error>
    {text}
  </div>
</div>

<style>
  .row {
    display: flex;
    justify-content: flex-start;
  }
  .row.user {
    justify-content: flex-end;
  }
  .bubble {
    max-width: 78%;
    padding: 0.6rem 0.85rem;
    border-radius: 14px;
    line-height: 1.45;
    font-size: 0.95rem;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--ai-bubble);
    color: var(--ai-text);
    border-bottom-left-radius: 4px;
  }
  .bubble.user {
    background: var(--accent);
    color: #fff;
    border-bottom-left-radius: 14px;
    border-bottom-right-radius: 4px;
  }
  .bubble.error {
    background: #fde8e8;
    color: #9b1c1c;
  }
</style>
