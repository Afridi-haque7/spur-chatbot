<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { api, ApiError } from '$lib/api';
  import type { ChatMessage } from '$lib/types';
  import MessageBubble from './MessageBubble.svelte';
  import TypingIndicator from './TypingIndicator.svelte';

  const SESSION_KEY = 'spur-chat-session-id';
  const MAX_LEN = 4000; // mirror of the server limit, for instant UX feedback

  // --- state ---
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let sending = $state(false);
  let loadingHistory = $state(true);
  let errorBanner = $state<string | null>(null);
  let sessionId: string | undefined;
  let listEl: HTMLDivElement;

  const trimmed = $derived(input.trim());
  const canSend = $derived(trimmed.length > 0 && trimmed.length <= MAX_LEN && !sending);
  const overLimit = $derived(input.length > MAX_LEN);

  async function scrollToBottom() {
    await tick();
    listEl?.scrollTo({ top: listEl.scrollHeight, behavior: 'smooth' });
  }

  onMount(async () => {
    sessionId = localStorage.getItem(SESSION_KEY) ?? undefined;
    if (sessionId) {
      try {
        const { messages: history } = await api.getHistory(sessionId);
        messages = history;
      } catch {
        // Stale/unknown session (e.g. DB reset): start fresh, don't block.
        localStorage.removeItem(SESSION_KEY);
        sessionId = undefined;
      }
    }
    loadingHistory = false;
    await scrollToBottom();
  });

  async function send() {
    if (!canSend) return;
    const text = trimmed;
    input = '';
    errorBanner = null;

    // Optimistically render the user message.
    const tempId = `tmp-${Date.now()}`;
    messages = [
      ...messages,
      { id: tempId, sender: 'user', text, createdAt: new Date().toISOString() },
    ];
    sending = true;
    await scrollToBottom();

    try {
      const res = await api.sendMessage(text, sessionId);
      if (!sessionId) {
        sessionId = res.sessionId;
        localStorage.setItem(SESSION_KEY, res.sessionId);
      }
      messages = [
        ...messages,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.reply,
          createdAt: new Date().toISOString(),
        },
      ];
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.';
      // Surface as an inline error bubble + a dismissible banner.
      messages = [
        ...messages,
        {
          id: `err-${Date.now()}`,
          sender: 'system',
          text: msg,
          createdAt: new Date().toISOString(),
        },
      ];
      errorBanner = msg;
    } finally {
      sending = false;
      await scrollToBottom();
    }
  }

  function onKeydown(e: KeyboardEvent) {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<div class="widget">
  <header class="header">
    <div class="avatar">N</div>
    <div>
      <div class="title">Nimbus Goods Support</div>
      <div class="subtitle">Usually replies instantly</div>
    </div>
  </header>

  <div class="messages" bind:this={listEl}>
    {#if loadingHistory}
      <div class="placeholder">Loading…</div>
    {:else if messages.length === 0}
      <div class="placeholder">
        Hi! Ask me about shipping, returns, payments, or support hours.
      </div>
    {/if}

    {#each messages as m (m.id)}
      <MessageBubble sender={m.sender} text={m.text} error={m.sender === 'system'} />
    {/each}

    {#if sending}
      <TypingIndicator />
    {/if}
  </div>

  {#if errorBanner}
    <div class="banner" role="alert">
      <span>{errorBanner}</span>
      <button class="banner-close" onclick={() => (errorBanner = null)} aria-label="Dismiss">×</button>
    </div>
  {/if}

  <div class="composer">
    <textarea
      bind:value={input}
      onkeydown={onKeydown}
      placeholder="Type a message…"
      rows="1"
      maxlength={MAX_LEN + 100}
      aria-label="Message"
    ></textarea>
    <button class="send" onclick={send} disabled={!canSend} aria-label="Send">
      {sending ? '…' : 'Send'}
    </button>
  </div>
  {#if overLimit}
    <div class="limit-warning">Message is too long (max {MAX_LEN} characters).</div>
  {/if}
</div>

<style>
  .widget {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 420px;
    height: 640px;
    max-height: 90vh;
    background: var(--surface);
    border-radius: 16px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.9rem 1rem;
    background: var(--accent);
    color: #fff;
  }
  .avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.22);
    display: grid;
    place-items: center;
    font-weight: 700;
  }
  .title {
    font-weight: 600;
    font-size: 0.98rem;
  }
  .subtitle {
    font-size: 0.78rem;
    opacity: 0.85;
  }
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    background: var(--bg-muted);
  }
  .placeholder {
    color: var(--text-muted);
    font-size: 0.9rem;
    text-align: center;
    margin: auto 1rem;
    line-height: 1.5;
  }
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.9rem;
    background: #fde8e8;
    color: #9b1c1c;
    font-size: 0.85rem;
  }
  .banner-close {
    background: none;
    border: none;
    color: inherit;
    font-size: 1.1rem;
    cursor: pointer;
    line-height: 1;
  }
  .composer {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  textarea {
    flex: 1;
    resize: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.6rem 0.7rem;
    font: inherit;
    font-size: 0.95rem;
    max-height: 120px;
    outline: none;
  }
  textarea:focus {
    border-color: var(--accent);
  }
  .send {
    align-self: flex-end;
    padding: 0.6rem 1.1rem;
    border: none;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .limit-warning {
    padding: 0 0.9rem 0.6rem;
    color: #9b1c1c;
    font-size: 0.78rem;
    background: var(--surface);
  }
</style>
