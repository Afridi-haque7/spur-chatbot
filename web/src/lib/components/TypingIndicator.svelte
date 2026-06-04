<div class="row" aria-label="Agent is typing">
  <div class="bubble">
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
</div>

<style>
  .row {
    display: flex;
    justify-content: flex-start;
  }
  .bubble {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    padding: 0.7rem 0.9rem;
    border-radius: 14px;
    border-bottom-left-radius: 4px;
    background: var(--ai-bubble);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #9aa3af;
    animation: blink 1.4s infinite both;
  }
  .dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  .dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  @keyframes blink {
    0%,
    80%,
    100% {
      opacity: 0.3;
    }
    40% {
      opacity: 1;
    }
  }
</style>
