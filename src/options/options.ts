import type { RuntimeMessage, RuntimeResponse } from '../core/messages';
import type { Settings } from '../core/settings';
import { clearVaultHandle, saveVaultHandle } from '../core/vault-store';

type DirectoryPicker = (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 120 或更高版本。');
  }
  return picker({ mode: 'readwrite' });
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`找不到元素 #${id}`);
  }
  return element as T;
}

function sendMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse>;
}

const folderInput = requiredElement<HTMLInputElement>('folder');
const filenameInput = requiredElement<HTMLInputElement>('filename');
const intervalInput = requiredElement<HTMLInputElement>('interval');
const saveButton = requiredElement<HTMLButtonElement>('save');
const saveStatus = requiredElement<HTMLElement>('save-status');
const vaultDot = requiredElement<HTMLElement>('vault-dot');
const vaultText = requiredElement<HTMLElement>('vault-text');
const pickVaultButton = requiredElement<HTMLButtonElement>('pick-vault');
const clearVaultButton = requiredElement<HTMLButtonElement>('clear-vault');

function fillForm(settings: Settings): void {
  folderInput.value = settings.dailyNoteFolder;
  filenameInput.value = settings.filenameFormat;
  intervalInput.value = String(settings.syncIntervalSeconds);
}

let vaultAuthorized = false;

function renderVaultStatus(hasVault: boolean): void {
  vaultAuthorized = hasVault;
  vaultDot.classList.toggle('authorized', hasVault);
  vaultText.textContent = hasVault ? '已授权' : '未授权';
  clearVaultButton.disabled = !hasVault;
}

async function refreshSettings(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'GET_SETTINGS' });
    if (!response.ok) {
      saveStatus.textContent = response.error ?? '读取设置失败';
      saveStatus.classList.add('error');
      return;
    }
    if (!response.settings) {
      saveStatus.textContent = '读取设置失败';
      saveStatus.classList.add('error');
      return;
    }
    fillForm(response.settings);
    renderVaultStatus(response.hasVault ?? false);
  } catch (error) {
    saveStatus.textContent = error instanceof Error ? error.message : String(error);
    saveStatus.classList.add('error');
  }
}

function setSaveStatus(text: string, isError = false): void {
  saveStatus.textContent = text;
  saveStatus.classList.toggle('error', isError);
}

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  setSaveStatus('正在保存…');
  try {
    const response = await sendMessage({
      type: 'SAVE_SETTINGS',
      settings: {
        dailyNoteFolder: folderInput.value,
        filenameFormat: filenameInput.value,
        syncIntervalSeconds: Number(intervalInput.value)
      }
    });
    if (response.ok && response.settings) {
      fillForm(response.settings);
      setSaveStatus('设置已保存。');
    } else {
      setSaveStatus(!response.ok ? (response.error ?? '保存设置失败') : '保存设置失败', true);
    }
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    saveButton.disabled = false;
  }
});

pickVaultButton.addEventListener('click', async () => {
  pickVaultButton.disabled = true;
  vaultText.textContent = '正在等待选择文件夹…';
  try {
    const handle = await pickDirectory();
    await saveVaultHandle(handle);
    renderVaultStatus(true);
    setSaveStatus('Vault 已授权。');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      renderVaultStatus(vaultAuthorized);
      setSaveStatus('已取消选择。');
    } else {
      renderVaultStatus(vaultAuthorized);
      setSaveStatus(error instanceof Error ? error.message : String(error), true);
    }
  } finally {
    pickVaultButton.disabled = false;
  }
});

clearVaultButton.addEventListener('click', async () => {
  clearVaultButton.disabled = true;
  try {
    await clearVaultHandle();
    renderVaultStatus(false);
    setSaveStatus('已移除 Vault 授权。');
  } catch (error) {
    setSaveStatus(error instanceof Error ? error.message : String(error), true);
  } finally {
    clearVaultButton.disabled = false;
  }
});

void refreshSettings();
