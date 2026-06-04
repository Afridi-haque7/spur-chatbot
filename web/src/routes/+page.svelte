<script lang="ts">
  import ChatWidget from '$lib/components/ChatWidget.svelte';
</script>

<svelte:head>
  <title>Nimbus Goods — Support</title>
</svelte:head>

<main>
  <div class="intro">
    <h1>Nimbus Goods</h1>
    <p>Small-batch home &amp; desk essentials. Questions? Chat with our support agent.</p>
  </div>
  <ChatWidget />
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem 1rem;
    background: linear-gradient(160deg, #eef2ff 0%, #f8fafc 60%);
  }
  .intro {
    text-align: center;
    max-width: 420px;
  }
  h1 {
    margin: 0 0 0.3rem;
    font-size: 1.6rem;
  }
  .intro p {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.5;
  }
</style>
