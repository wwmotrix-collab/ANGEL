/**
 * core/ui.js
 * WWMX Campaign — Componentes de UI reutilizáveis
 *
 * Exibe toasts, modais, loading, etc. Depende apenas de design.css.
 */

(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────
  // TOASTS
  // ─────────────────────────────────────────────────────────
  let toastContainer = null;

  function _garantirToastContainer() {
    if (!toastContainer) {
      toastContainer = document.querySelector('.toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
      }
    }
    return toastContainer;
  }

  /**
   * Exibe um toast com mensagem e tipo.
   * @param {string} msg
   * @param {string} tipo  'success', 'error', 'info' (padrão: 'info')
   * @param {number} duracao ms (padrão: 3000)
   */
  function showToast(msg, tipo = 'info', duracao = 3000) {
    const container = _garantirToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, duracao);
  }

  // ─────────────────────────────────────────────────────────
  // LOADING GLOBAL
  // ─────────────────────────────────────────────────────────
  let loadingOverlay = null;

  function _criarLoadingOverlay() {
    const div = document.createElement('div');
    div.id = 'wwmx-loading';
    div.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      flex-direction: column;
      gap: 12px;
      color: white;
      font-family: 'Syne', sans-serif;
      font-weight: 600;
      transition: opacity 0.2s;
    `;
    div.innerHTML = `
      <div style="width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.3); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <span>Carregando...</span>
    `;
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    return div;
  }

  function showLoading() {
    if (!loadingOverlay) {
      loadingOverlay = _criarLoadingOverlay();
      document.body.appendChild(loadingOverlay);
    }
    loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────
  // MODAIS (genéricos)
  // ─────────────────────────────────────────────────────────
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('show');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('show');
  }

  function closeModalOnOverlay(event, modalId) {
    if (event.target === document.getElementById(modalId)) {
      closeModal(modalId);
    }
  }

  // ─────────────────────────────────────────────────────────
  // UTILITÁRIOS DE FORMULÁRIO
  // ─────────────────────────────────────────────────────────
  function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    const data = new FormData(form);
    return Object.fromEntries(data.entries());
  }

  function setFormData(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    for (const [key, value] of Object.entries(data)) {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    }
  }

  // ─────────────────────────────────────────────────────────
  // EXPORTAÇÃO
  // ─────────────────────────────────────────────────────────
  global.WWMX = global.WWMX || {};
  global.WWMX.UI = {
    showToast,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    closeModalOnOverlay,
    getFormData,
    setFormData,
  };

  // Atalhos globais para compatibilidade com módulos legados
  global.showToast = showToast;
  global.showLoading = showLoading;
  global.hideLoading = hideLoading;
  global.openModal = openModal;
  global.closeModal = closeModal;

}(window));