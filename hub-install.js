(function () {
  'use strict';
  const button = document.getElementById('hubInstall');
  const status = document.getElementById('hubInstallStatus');
  if (!button || !status) return;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let offer = null, pending = false, installed = false;
  function render(message) {
    button.disabled = pending || installed || standalone.matches || !offer;
    status.textContent = standalone.matches
      ? 'PAPA HUBはアプリの画面で開いています。'
      : message;
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (installed || standalone.matches) return;
    offer = event;
    render('このボタンからChromeのインストール確認を開けます。');
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    offer = null;
    render('Chromeからインストール完了の通知を受け取りました。ホーム画面にPAPA HUBがあるか確認してください。');
  });
  standalone.addEventListener('change', () => render('この画面ではまだインストールを開始できません。ショートカットから引き続き使えます。'));
  button.addEventListener('click', async () => {
    if (button.disabled || !offer || pending) return;
    const current = offer;
    offer = null;
    pending = true;
    render('Chromeの確認画面でインストールを選んでください。');
    let message;
    try {
      await current.prompt();
      const choice = await current.userChoice;
      message = choice && choice.outcome === 'accepted'
        ? 'インストールを受け付けました。完了の通知を待っています。ホーム画面への追加はまだ未確認です。'
        : 'インストールは見送りました。HUBはこの画面で引き続き使えます。';
    } catch (_) {
      message = 'インストールを開始できませんでした。HUBはこの画面で引き続き使えます。';
    } finally {
      pending = false;
      if (!installed) render(offer ? 'このボタンからChromeのインストール確認を開けます。' : message);
    }
  });
  render(status.textContent);
}());
