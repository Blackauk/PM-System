import { getInspectionsDB } from './schema';

// Cache asset metadata for offline use
export interface CachedAsset {
  id: string;
  name: string;
  siteId?: string;
  siteName?: string;
  locationId?: string;
  locationName?: string;
  assetTypeId?: string;
  assetTypeCode?: string;
  cachedAt: string;
}

// Cache user metadata for offline use
export interface CachedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  cachedAt: string;
}

// Cache asset
export async function cacheAsset(asset: CachedAsset): Promise<void> {
  const db = await getInspectionsDB();
  await db.put('assetCache', {
    ...asset,
    cachedAt: new Date().toISOString(),
  });
}

// Get cached asset
export async function getCachedAsset(assetId: string): Promise<CachedAsset | undefined> {
  const db = await getInspectionsDB();
  return db.get('assetCache', assetId);
}

// Cache multiple assets
export async function cacheAssets(assets: CachedAsset[]): Promise<void> {
  const db = await getInspectionsDB();
  const tx = db.transaction('assetCache', 'readwrite');
  await Promise.all(assets.map(asset => tx.store.put({
    ...asset,
    cachedAt: new Date().toISOString(),
  })));
  await tx.done;
}

// Cache user
export async function cacheUser(user: CachedUser): Promise<void> {
  const db = await getInspectionsDB();
  await db.put('userCache', {
    ...user,
    cachedAt: new Date().toISOString(),
  });
}

// Get cached user
export async function getCachedUser(userId: string): Promise<CachedUser | undefined> {
  const db = await getInspectionsDB();
  return db.get('userCache', userId);
}

// Cache multiple users
export async function cacheUsers(users: CachedUser[]): Promise<void> {
  const db = await getInspectionsDB();
  const tx = db.transaction('userCache', 'readwrite');
  await Promise.all(users.map(user => tx.store.put({
    ...user,
    cachedAt: new Date().toISOString(),
  })));
  await tx.done;
}

// Clear old cache entries (older than 30 days)
export async function clearOldCache(): Promise<void> {
  const db = await getInspectionsDB();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Clear old asset cache
  const assetCache = db.transaction('assetCache', 'readwrite').store;
  const assets = await assetCache.getAll();
  for (const asset of assets) {
    if (new Date(asset.cachedAt) < thirtyDaysAgo) {
      await assetCache.delete(asset.id);
    }
  }

  // Clear old user cache
  const userCache = db.transaction('userCache', 'readwrite').store;
  const users = await userCache.getAll();
  for (const user of users) {
    if (new Date(user.cachedAt) < thirtyDaysAgo) {
      await userCache.delete(user.id);
    }
  }
}


