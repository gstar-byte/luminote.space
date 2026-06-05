import firebaseConfig from '../../firebase-applet-config.json';

let app: any = null;
let dbInstance: any = null;
let authInstance: any = null;
let googleProviderInstance: any = null;
let appleProviderInstance: any = null;

let firebaseAppModule: any = null;
let firebaseAuthModule: any = null;
let firebaseFirestoreModule: any = null;

export async function ensureFirebaseReady() {
  if (firebaseAppModule && firebaseAuthModule && firebaseFirestoreModule) {
    return;
  }
  
  // 并行动态导入 Firebase SDK，极大降低首屏未登录包体积
  const [appMod, authMod, firestoreMod] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore')
  ]);
  
  firebaseAppModule = appMod;
  firebaseAuthModule = authMod;
  firebaseFirestoreModule = firestoreMod;
  
  if (!app) {
    app = firebaseAppModule.initializeApp(firebaseConfig);
  }
  if (!dbInstance) {
    dbInstance = firebaseFirestoreModule.getFirestore(app, firebaseConfig.firestoreDatabaseId);
    // 启用 IndexedDB 离线持久化
    firebaseFirestoreModule.enableIndexedDbPersistence(dbInstance).catch((err: any) => {
      console.warn("Firestore persistence failed to enable:", err.code);
    });
  }
  if (!authInstance) {
    authInstance = firebaseAuthModule.getAuth(app);
  }
  if (!googleProviderInstance) {
    googleProviderInstance = new firebaseAuthModule.GoogleAuthProvider();
  }
  if (!appleProviderInstance) {
    appleProviderInstance = new firebaseAuthModule.OAuthProvider('apple.com');
  }
}

// 导出获取实例的同步函数，以保持与 App.tsx 原生同步调用的绝对兼容性
export function getDb() {
  if (!dbInstance) {
    if (!firebaseFirestoreModule) {
      // 尚未加载就绪时的回退代理（防止抛出 undefined 崩溃）
      return null as any;
    }
    dbInstance = firebaseFirestoreModule.getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  return dbInstance;
}

export function getAuth() {
  if (!authInstance) {
    if (!firebaseAuthModule) {
      // 尚未加载就绪时的回退代理（防止抛出 undefined.currentUser 崩溃）
      return {
        currentUser: null,
      } as any;
    }
    authInstance = firebaseAuthModule.getAuth(app);
  }
  return authInstance;
}

export function getGoogleProvider() {
  if (!googleProviderInstance) {
    if (!firebaseAuthModule) {
      return null as any;
    }
    googleProviderInstance = new firebaseAuthModule.GoogleAuthProvider();
  }
  return googleProviderInstance;
}

export function getAppleProvider() {
  if (!appleProviderInstance) {
    if (!firebaseAuthModule) {
      return null as any;
    }
    appleProviderInstance = new firebaseAuthModule.OAuthProvider('apple.com');
  }
  return appleProviderInstance;
}

// 辅助方法：确保 Firestore 模块已就绪的快捷获取
function getFirestoreModule() {
  if (!firebaseFirestoreModule) {
    throw new Error('Firestore is not loaded yet. Make sure you await ensureFirebaseReady() first.');
  }
  return firebaseFirestoreModule;
}

// 同步辅助函数：这些在已登录的组件渲染中是同步调用的。
// 因为组件是在 ensureFirebaseReady() 完成后才真正激活数据操作，所以它们可以安全地同步调用已就绪的模块。
export const doc = (...args: any[]) => getFirestoreModule().doc(...args);
export const collection = (...args: any[]) => getFirestoreModule().collection(...args);
export const query = (...args: any[]) => getFirestoreModule().query(...args);
export const where = (...args: any[]) => getFirestoreModule().where(...args);
export const writeBatch = (...args: any[]) => getFirestoreModule().writeBatch(...args);
export const serverTimestamp = () => getFirestoreModule().serverTimestamp();
export const deleteField = () => getFirestoreModule().deleteField();

// 异步写/查操作：直接包装成 async 函数，对外界完全透明且更加安全
export const setDoc = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseFirestoreModule.setDoc(...args);
};

export const getDocs = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseFirestoreModule.getDocs(...args);
};

export const addDoc = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseFirestoreModule.addDoc(...args);
};

export const updateDoc = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseFirestoreModule.updateDoc(...args);
};

export const deleteDoc = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseFirestoreModule.deleteDoc(...args);
};

// 带有事件解绑的订阅操作：返回一个可以同步注销的代理函数
export const onSnapshot = (reference: any, callback: any, onError?: any) => {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  ensureFirebaseReady().then(() => {
    if (isCancelled) return;
    unsub = firebaseFirestoreModule.onSnapshot(reference, callback, onError);
  });

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
};

// Auth 相关异步操作
export const signInWithPopup = async (...args: any[]) => {
  await ensureFirebaseReady();
  // 无论外界传进来的是什么，都使用真正实例化后的 getAuth()
  return firebaseAuthModule.signInWithPopup(getAuth(), getGoogleProvider());
};

export const signInWithRedirect = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signInWithRedirect(getAuth(), getGoogleProvider());
};

export const getRedirectResult = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.getRedirectResult(getAuth());
};

export const signOut = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signOut(getAuth());
};

export const createUserWithEmailAndPassword = async (ignoredAuth: any, ...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.createUserWithEmailAndPassword(getAuth(), ...args);
};

export const signInWithEmailAndPassword = async (ignoredAuth: any, ...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signInWithEmailAndPassword(getAuth(), ...args);
};

export const sendPasswordResetEmail = async (ignoredAuth: any, ...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.sendPasswordResetEmail(getAuth(), ...args);
};

export const updateProfile = async (ignoredAuth: any, ...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.updateProfile(getAuth(), ...args);
};

// Auth 状态监听：同样需要像 onSnapshot 一样能同步返回 unsubscribe 函数
export const onAuthStateChanged = (ignoredAuth: any, callback: any) => {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  ensureFirebaseReady().then(() => {
    if (isCancelled) return;
    const realAuth = getAuth();
    unsub = firebaseAuthModule.onAuthStateChanged(realAuth, callback);
    // 修复竞态条件：如果在注册监听器之前用户已经通过 popup 登录成功，
    // onAuthStateChanged 的初始回调可能不会触发（或触发时为 null 后又立刻变为 user）。
    // 这里做一次显式检查：如果 currentUser 已经存在，立即手动回调一次确保 UI 响应。
    if (realAuth.currentUser) {
      callback(realAuth.currentUser);
    }
  });

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
};
