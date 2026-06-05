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

// 导出获取实例的 async 函数
export async function getDb() {
  await ensureFirebaseReady();
  return dbInstance;
}

export async function getAuth() {
  await ensureFirebaseReady();
  return authInstance;
}

export async function getGoogleProvider() {
  await ensureFirebaseReady();
  return googleProviderInstance;
}

export async function getAppleProvider() {
  await ensureFirebaseReady();
  return appleProviderInstance;
}

// 辅助方法：确保 Firestore 模块已就绪的快捷获取
function getFirestoreModule() {
  if (!firebaseFirestoreModule) {
    throw new Error('Firestore is not loaded yet. Make sure you await ensureFirebaseReady() first.');
  }
  return firebaseFirestoreModule;
}

function getAuthModule() {
  if (!firebaseAuthModule) {
    throw new Error('Auth is not loaded yet. Make sure you await ensureFirebaseReady() first.');
  }
  return firebaseAuthModule;
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
  return firebaseAuthModule.signInWithPopup(...args);
};

export const signInWithRedirect = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signInWithRedirect(...args);
};

export const getRedirectResult = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.getRedirectResult(...args);
};

export const signOut = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signOut(...args);
};

export const createUserWithEmailAndPassword = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.createUserWithEmailAndPassword(...args);
};

export const signInWithEmailAndPassword = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.signInWithEmailAndPassword(...args);
};

export const sendPasswordResetEmail = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.sendPasswordResetEmail(...args);
};

export const updateProfile = async (...args: any[]) => {
  await ensureFirebaseReady();
  return firebaseAuthModule.updateProfile(...args);
};

// Auth 状态监听：同样需要像 onSnapshot 一样能同步返回 unsubscribe 函数
export const onAuthStateChanged = (auth: any, callback: any) => {
  let unsub: (() => void) | null = null;
  let isCancelled = false;

  ensureFirebaseReady().then(() => {
    if (isCancelled) return;
    unsub = firebaseAuthModule.onAuthStateChanged(auth, callback);
  });

  return () => {
    isCancelled = true;
    if (unsub) unsub();
  };
};
