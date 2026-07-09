import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 默认打包环境变量
const defaultUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const defaultKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!defaultUrl || !defaultKey) {
  console.warn('[Supabase Mobile] URL or Anon Key is missing. Check your environment variables.');
}

// 导出可被外部修改的 supabase 客户端引用
export let supabase = createClient(defaultUrl, defaultKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 动态载入 AsyncStorage 的凭据，并重置 Supabase 实例
export async function refreshSupabaseClient() {
  try {
    const savedUrl = await AsyncStorage.getItem('luminote_supabase_url');
    const savedKey = await AsyncStorage.getItem('luminote_supabase_anon_key');
    const url = savedUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const key = savedKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

    if (url && key) {
      // 重新实例化
      supabase = createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
      // 重新拉取一次当前用户
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        currentAuthUser = mapSupabaseUserToFirebase(session.user);
      } else {
        currentAuthUser = null;
      }
      console.log('[Supabase Mobile] Client successfully updated & refreshed with keys:', url.substring(0, 15) + '...');
    }
  } catch (e) {
    console.warn('[Supabase Mobile] Failed to refresh client:', e);
  }
}

// 缓存当前登录用户，以支持同步的 auth.currentUser 获取
let currentAuthUser: any = null;

// 初始化异步刷新客户端
void refreshSupabaseClient().then(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      currentAuthUser = mapSupabaseUserToFirebase(session.user);
    }
  });
});

function mapSupabaseUserToFirebase(user: any): any {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Lumi User',
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

// 辅助方法：生成随机ID
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// 辅助方法：驼峰式命名与蛇形命名互转
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));

function toCamelCaseKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCaseKeys);
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    newObj[snakeToCamel(key)] = toCamelCaseKeys(obj[key]);
  }
  return newObj;
}

function toSnakeCaseKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnakeCaseKeys);
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    if (key === 'reminder' || key === 'tags') {
      newObj[camelToSnake(key)] = obj[key];
    } else {
      newObj[camelToSnake(key)] = toSnakeCaseKeys(obj[key]);
    }
  }
  return newObj;
}

export const db = supabase;
export type User = any;

export function getDb(): any {
  return supabase;
}

// 暴露出满足 initAuth() 等原版定义的 auth 实例对象
export const auth: any = {
  get currentUser() {
    return currentAuthUser;
  }
};

export const googleProvider: any = { providerId: 'google.com' };
export const appleProvider: any = { providerId: 'apple.com' };
export const facebookProvider: any = { providerId: 'facebook.com' };

// 模拟 Firestore 引用模型
export const doc = (parent: any, path?: string, id?: string): any => {
  if (parent && parent.collection) {
    const collectionName = parent.collection;
    const docId = path || generateId();
    return {
      collection: collectionName,
      id: docId,
      path: `${collectionName}/${docId}`
    };
  } else {
    const parts = path ? path.split('/') : [];
    const collectionName = parts[0];
    const docId = id || parts[1] || generateId();
    return {
      collection: collectionName,
      id: docId,
      path: docId ? `${collectionName}/${docId}` : collectionName
    };
  }
};

export const collection = (dbInstance: any, path: string): any => {
  return {
    collection: path,
    path: path
  };
};

export const query = (colRef: any, ...constraints: any[]): any => {
  return {
    collection: colRef.collection,
    constraints: constraints
  };
};

export const where = (field: string, op: string, value: any): any => {
  return {
    field: camelToSnake(field),
    op,
    value
  };
};

export const deleteField = (): any => {
  return '__DELETE_FIELD__';
};

// 写操作
export const setDoc = async (docRef: any, data: any, options?: { merge?: boolean }): Promise<any> => {
  const tableName = docRef.collection === 'users' ? 'profiles' : docRef.collection;
  const rawPayload = { ...data };
  
  for (const key of Object.keys(rawPayload)) {
    if (rawPayload[key] === '__DELETE_FIELD__') {
      delete rawPayload[key];
    }
  }

  const payload = toSnakeCaseKeys(rawPayload);
  payload.id = docRef.id;

  const { error } = await supabase.from(tableName).upsert(payload);
  if (error) throw error;
};

export const updateDoc = async (docRef: any, data: any): Promise<any> => {
  const tableName = docRef.collection === 'users' ? 'profiles' : docRef.collection;
  const payload = toSnakeCaseKeys(data);
  
  const { error } = await supabase.from(tableName).update(payload).eq('id', docRef.id);
  if (error) throw error;
};

export const deleteDoc = async (docRef: any): Promise<any> => {
  const tableName = docRef.collection === 'users' ? 'profiles' : docRef.collection;
  const { error } = await supabase.from(tableName).delete().eq('id', docRef.id);
  if (error) throw error;
};

export const addDoc = async (colRef: any, data: any): Promise<any> => {
  const tableName = colRef.collection === 'users' ? 'profiles' : colRef.collection;
  const payload = toSnakeCaseKeys(data);
  const { data: insertedData, error } = await supabase.from(tableName).insert(payload).select().single();
  if (error) throw error;
  return {
    id: insertedData.id,
    data: () => toCamelCaseKeys(insertedData),
    get ref() {
      return doc(supabase, tableName === 'profiles' ? 'users' : tableName, insertedData.id);
    }
  };
};

export const getDocs = async (queryRef: any): Promise<any> => {
  const tableName = queryRef.collection === 'users' ? 'profiles' : queryRef.collection;
  let builder: any = supabase.from(tableName).select();

  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c.op === '==') {
        builder = builder.eq(c.field, c.value);
      }
    }
  }

  const { data, error } = await builder;
  if (error) throw error;

  return {
    docs: (data || []).map((item: any) => {
      const docData = toCamelCaseKeys(item);
      return {
        id: item.id,
        data: () => docData,
        get ref() {
          return doc(supabase, tableName === 'profiles' ? 'users' : tableName, item.id);
        }
      };
    })
  };
};

export const writeBatch = (dbInstance?: any): any => {
  const operations: (() => Promise<void>)[] = [];
  return {
    set(docRef: any, data: any, options?: any) {
      operations.push(() => setDoc(docRef, data, options));
    },
    update(docRef: any, data: any) {
      operations.push(() => updateDoc(docRef, data));
    },
    delete(docRef: any) {
      operations.push(() => deleteDoc(docRef));
    },
    async commit() {
      await Promise.all(operations.map(op => op()));
    }
  };
};

// 实时快照订阅
export const onSnapshot = (ref: any, callback: (snapshot: any) => void, onError?: (error: any) => void): any => {
  let isUnsubscribed = false;
  const tableName = ref.collection === 'users' ? 'profiles' : ref.collection;
  
  const fetchData = async () => {
    try {
      let builder: any = supabase.from(tableName).select();
      
      if (ref.id) {
        builder = builder.eq('id', ref.id);
      } else if (ref.constraints) {
        for (const c of ref.constraints) {
          if (c.op === '==') {
            builder = builder.eq(c.field, c.value);
          }
        }
      }

      const { data, error } = await builder;
      if (error) {
        if (onError) onError(error);
        return;
      }

      if (isUnsubscribed) return;

      if (ref.id) {
        const docItem = data && data[0];
        callback({
          exists: () => !!docItem,
          data: () => docItem ? toCamelCaseKeys(docItem) : null
        });
      } else {
        callback({
          metadata: { fromCache: false },
          docs: (data || []).map((item: any) => {
            const docData = toCamelCaseKeys(item);
            return {
              id: item.id,
              data: () => docData,
              get ref() {
                return doc(supabase, tableName === 'profiles' ? 'users' : tableName, item.id);
              }
            };
          })
        });
      }
    } catch (e) {
      if (onError) onError(e);
    }
  };

  fetchData();

  const channel = supabase
    .channel(`${tableName}-mobile-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
      if (!isUnsubscribed) {
        fetchData();
      }
    })
    .subscribe();

  return () => {
    isUnsubscribed = true;
    supabase.removeChannel(channel);
  };
};

export const signOut = async (...args: any[]): Promise<any> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentAuthUser = null;
};

export const createUserWithEmailAndPassword = async (authInst: any, email: string, pass: string): Promise<any> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass
  });
  if (error) throw error;
  currentAuthUser = mapSupabaseUserToFirebase(data.user);
  return {
    user: currentAuthUser
  };
};

export const signInWithEmailAndPassword = async (authInst: any, email: string, pass: string): Promise<any> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });
  if (error) throw error;
  currentAuthUser = mapSupabaseUserToFirebase(data.user);
  return {
    user: currentAuthUser
  };
};

export const sendPasswordResetEmail = async (authInst: any, email: string): Promise<any> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};

export const updateProfile = async (authInst: any, data: { displayName?: string; photoURL?: string }): Promise<any> => {
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: data.displayName,
      avatar_url: data.photoURL
    }
  });
  if (error) throw error;
  if (currentAuthUser) {
    currentAuthUser.displayName = data.displayName || currentAuthUser.displayName;
    currentAuthUser.photoURL = data.photoURL || currentAuthUser.photoURL;
  }
};

export const onAuthStateChanged = (authInst: any, callback: (user: any) => void): any => {
  callback(currentAuthUser);

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const firebaseUser = session ? mapSupabaseUserToFirebase(session.user) : null;
    currentAuthUser = firebaseUser;
    callback(firebaseUser);
  });

  return () => {
    subscription.unsubscribe();
  };
};
