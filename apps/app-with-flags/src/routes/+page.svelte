<script>
  let { data } = $props();
</script>

<h1>App With Flags</h1>
<p>This SvelteKit app uses the <code>flags</code> package with <code>flags/sveltekit</code> integration.</p>
<p>Server time: {data.serverTime}</p>
<p>Show banner flag: {data.showBanner}</p>
