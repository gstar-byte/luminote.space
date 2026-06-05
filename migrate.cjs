const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./ai-studio-applet-webapp-e17fe-firebase-adminsdk-fbsvc-984293a49b.json');

// 初始化 Admin 凭证
const oldApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'oldApp');

const newApp = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, 'newApp');

// 连接旧的共享配额数据库与新的 (default) 数据库
const oldDb = getFirestore(oldApp, 'ai-studio-8168f6c5-af0e-4af5-a66e-1210ad9c976d');
const newDb = getFirestore(newApp);

async function migrateCollection(colId) {
  console.log(`\n📦 正在从旧数据库读取集合: [${colId}]...`);
  const snapshot = await oldDb.collection(colId).get();
  console.log(`👉 读取成功！集合 [${colId}] 共有 ${snapshot.size} 个文档`);
  
  if (snapshot.empty) {
    console.log(`⚠️ 集合 [${colId}] 为空，无需迁移。`);
    return;
  }

  const docs = snapshot.docs;
  const batchLimit = 400; // 安全阈值，单次 batch 不超过 500
  for (let i = 0; i < docs.length; i += batchLimit) {
    const chunk = docs.slice(i, i + batchLimit);
    const batch = newDb.batch();
    
    chunk.forEach(doc => {
      const docRef = newDb.collection(colId).doc(doc.id);
      batch.set(docRef, doc.data());
    });
    
    console.log(`⏳ 正在写入新默认数据库 [${colId}] 批次 (${i + 1} 到 ${Math.min(i + batchLimit, docs.length)})...`);
    await batch.commit();
  }
  
  console.log(`✅ 集合 [${colId}] 成功同步到新库！`);
}

async function migrate() {
  console.log('==================================================');
  console.log('🚀 开始直接复制核心业务数据到新默认数据库 (default)...');
  console.log('==================================================');
  
  // 核心业务数据就是 capsules (便签)，其他类似于用户信息等通常在客户端登录时会自动创建
  const targetCollections = ['capsules'];

  for (const colId of targetCollections) {
    try {
      await migrateCollection(colId);
    } catch (err) {
      console.error(`❌ 迁移集合 [${colId}] 失败:`, err.message);
    }
  }
  
  console.log('\n==================================================');
  console.log('🎉 恭喜！迁移逻辑运行完毕！');
  console.log('==================================================');
}

migrate().catch(error => {
  console.error('\n❌ 迁移过程中发生致命错误:', error);
});
