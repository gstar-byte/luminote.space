import { supabase } from './supabaseClient';

let currentAuthUser: any = null;

let initialSessionPromise: Promise<any> | null = null;

supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    currentAuthUser = mapSupabaseUser(session.user);
  }
});

function ensureInitialSession(): Promise<any> {
  if (!initialSessionPromise) {
    initialSessionPromise = supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        currentAuthUser = mapSupabaseUser(session.user);
      }
      return currentAuthUser;
    });
  }
  return initialSessionPromise;
}

function mapSupabaseUser(user: any): any {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Lumi User',
    photoURL: user.user_metadata?.avatar_url || null,
  };
}

// 辅助方法：生成随机小写字母+数字的随机ID
const generateId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// 辅助方法：驼峰式命名与蛇形命名互转
const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const snakeToCamel = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));

function toCamelCaseKeys(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCaseKeys);
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if ((key === 'created_at' || key === 'updated_at') && typeof value === 'string') {
      newObj[snakeToCamel(key)] = new Date(value).getTime();
    } else {
      newObj[snakeToCamel(key)] = toCamelCaseKeys(value);
    }
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

export async function ensureReady(): Promise<any> {
  return Promise.resolve();
}

export function getDb(): any {
  return supabase;
}

export function getAuth(): any {
  return {
    get currentUser() {
      return currentAuthUser;
    }
  } as any;
}

export function getGoogleProvider(): any {
  return { providerId: 'google.com' };
}

export function getAppleProvider(): any {
  return { providerId: 'apple.com' };
}

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

// capsules 表实际存在的列（蛇形命名）
const CAPSULES_COLUMNS = new Set([
  'id', 'user_id', 'content', 'subject', 'category', 'tag', 'tags', 'timestamp',
  'color', 'is_todo', 'completed', 'is_archived', 'is_deleted',
  'reminder', 'attachments', 'is_starred', 'is_pinned', 'created_at', 'updated_at'
]);

// profiles 表实际存在的列
const PROFILES_COLUMNS = new Set([
  'id', 'email', 'display_name', 'photo_url', 'created_at'
]);

/**
 * 根据表的实际 schema 过滤 payload，只保留存在的列。
 * 同时处理字段映射（如 created_at 数值 → timestamp）。
 */
function filterPayloadForTable(tableName: string, payload: Record<string, any>): Record<string, any> {
  const allowedColumns = tableName === 'profiles' ? PROFILES_COLUMNS : CAPSULES_COLUMNS;
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === '__DELETE_FIELD__') continue; // 不发送删除标记

    if (allowedColumns.has(key)) {
      filtered[key] = value;
    }
  }

  // 字段映射：代码发送 created_at（数值时间戳），DB 中对应 timestamp 列
  if (tableName !== 'profiles' && !filtered.timestamp && filtered.created_at && typeof filtered.created_at === 'number') {
    filtered.timestamp = filtered.created_at;
  }

  // DB 中 created_at / updated_at 是 timestamptz 类型，数值需要转换为 ISO 字符串存储
  if (typeof filtered.created_at === 'number') {
    filtered.created_at = new Date(filtered.created_at).toISOString();
  }
  if (typeof filtered.updated_at === 'number') {
    filtered.updated_at = new Date(filtered.updated_at).toISOString();
  }

  return filtered;
}

export const setDoc = async (docRef: any, data: any, options?: { merge?: boolean }): Promise<any> => {
  const tableName = docRef.collection === 'users' ? 'profiles' : docRef.collection;
  const rawPayload = { ...data };
  
  for (const key of Object.keys(rawPayload)) {
    if (rawPayload[key] === '__DELETE_FIELD__') {
      delete rawPayload[key];
    }
  }

  const snaked = toSnakeCaseKeys(rawPayload);
  snaked.id = docRef.id;
  const payload = filterPayloadForTable(tableName, snaked);

  const { error } = await supabase.from(tableName).upsert(payload);
  if (error) throw error;
};

export const updateDoc = async (docRef: any, data: any): Promise<any> => {
  const tableName = docRef.collection === 'users' ? 'profiles' : docRef.collection;
  const snaked = toSnakeCaseKeys(data);
  const payload = filterPayloadForTable(tableName, snaked);
  
  // 如果过滤后没有有效字段要更新，直接跳过
  if (Object.keys(payload).length === 0) return;

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
  const snaked = toSnakeCaseKeys(data);
  const payload = filterPayloadForTable(tableName, snaked);
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
    docs: (data || []).map(item => {
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
  const operations: Array<() => Promise<void>> = [];
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
          docs: (data || []).map(item => {
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

  const channelId = `${tableName}-changes-${Math.random().toString(36).slice(2, 9)}`;
  const channel = supabase
    .channel(channelId)
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

export const signInWithPopup = async (authInstance: any, provider: any): Promise<any> => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.providerId === 'google.com' ? 'google' : 'apple',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
  return data;
};

export const signInWithRedirect = async (authInstance: any, provider: any): Promise<any> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: provider.providerId === 'google.com' ? 'google' : 'apple',
    options: {
      redirectTo: window.location.origin
    }
  });
  if (error) throw error;
};

export const getRedirectResult = async (...args: any[]): Promise<any> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) return null;
  return {
    user: mapSupabaseUser(session.user)
  };
};

export const signOut = async (...args: any[]): Promise<any> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  currentAuthUser = null;
};

export const createUserWithEmailAndPassword = async (authInst: any, email: string, pass: string): Promise<any> => {
  const displayName = email.split('@')[0];
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        display_name: displayName,
        full_name: displayName
      }
    }
  });
  if (error) throw error;
  // 注册后如果需要邮符1确认，session 可能为 null，但 user 会有值
  const mappedUser = mapSupabaseUser(data.user);
  currentAuthUser = mappedUser;
  return {
    user: { ...mappedUser, _supabaseUser: data.user, _session: data.session }
  };
};

export const signInWithEmailAndPassword = async (authInst: any, email: string, pass: string): Promise<any> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass
  });
  if (error) throw error;
  currentAuthUser = mapSupabaseUser(data.user);
  return {
    user: currentAuthUser
  };
};

export const sendPasswordResetEmail = async (authInst: any, email: string): Promise<any> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
};

export const updateProfile = async (authInst: any, data: { displayName?: string; photoURL?: string }): Promise<any> => {
  // 首先检查是否有有效 session；注册后待确认情况下 session 为 null，直接更新本地即可
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // 无 session（待测邮符1确认）—— 局部更新显示名即可，不调用 API
      if (currentAuthUser && data.displayName) {
        currentAuthUser.displayName = data.displayName;
      }
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: data.displayName,
        avatar_url: data.photoURL
      }
    });
    if (error) throw error;
  } catch (err: any) {
    // 静默处理：如果更新失败（如 Auth session missing），就局部更新一下
    if (currentAuthUser && data.displayName) {
      currentAuthUser.displayName = data.displayName;
    }
    console.warn('[updateProfile] skipped (no session or error):', err?.message);
    return;
  }
  if (currentAuthUser) {
    currentAuthUser.displayName = data.displayName || currentAuthUser.displayName;
    currentAuthUser.photoURL = data.photoURL || currentAuthUser.photoURL;
  }
};

export const onAuthStateChanged = (authInst: any, callback: (user: any) => void): any => {
  let isUnsubscribed = false;

  ensureInitialSession().then((user) => {
    if (!isUnsubscribed) {
      callback(user);
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    const mappedUser = session ? mapSupabaseUser(session.user) : null;
    currentAuthUser = mappedUser;
    callback(mappedUser);
  });

  return () => {
    isUnsubscribed = true;
    subscription.unsubscribe();
  };
};
