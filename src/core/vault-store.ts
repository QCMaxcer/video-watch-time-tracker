const DB_NAME = 'video-watch-time-tracker';
const STORE_NAME = 'vault';
const HANDLE_KEY = 'directory-handle';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = action(transaction.objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
      })
  );
}

export async function saveVaultHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await run('readwrite', (store) => store.put(handle, HANDLE_KEY));
}

export async function loadVaultHandle(): Promise<FileSystemDirectoryHandle | null> {
  const handle = await run<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(HANDLE_KEY));
  return handle ?? null;
}

export async function clearVaultHandle(): Promise<void> {
  await run('readwrite', (store) => store.delete(HANDLE_KEY));
}
