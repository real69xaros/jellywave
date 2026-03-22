class StorageManager {
  constructor() {
    this.dbName = 'jellywave_offline_db';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = (e) => reject('IndexedDB error');
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('tracks')) {
          db.createObjectStore('tracks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs'); 
        }
        if (!db.objectStoreNames.contains('artwork')) {
           db.createObjectStore('artwork'); 
        }
      };
    });
  }

  async put(storeName, key, data) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      let request;
      if (storeName === 'tracks') request = store.put(data);
      else request = store.put(data, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  }

  async get(storeName, key) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => reject();
    });
  }

  async getAll(storeName) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = () => reject();
    });
  }

  async delete(storeName, key) {
    await this.initPromise;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject();
    });
  }

  async isDownloaded(id) {
    const track = await this.get('tracks', id);
    return !!track;
  }
}

const storage = new StorageManager();
