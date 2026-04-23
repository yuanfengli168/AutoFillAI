(() => {
  const key = '__autofillai_content_loading__';
  if (globalThis[key]) return;
  globalThis[key] = true;

  import(chrome.runtime.getURL('content.js'))
    .catch((error) => {
      console.error('AutoFillAI bootstrap failed to load content module', error);
      globalThis[key] = false;
    });
})();
