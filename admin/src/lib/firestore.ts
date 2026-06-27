import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
  type WhereFilterOp,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

type DocPath = string;
type ColPath = string;

function handleError(err: unknown, msg: string): never {
  console.error(`${msg}:`, err);
  throw new Error(msg);
}

export function ref<T = DocumentData>(path: DocPath) {
  return doc(db, path) as any;
}

export function colRef<T = DocumentData>(path: ColPath) {
  return collection(db, path) as any;
}

export async function getDocument<T>(path: DocPath): Promise<T | null> {
  try {
    const snap = await getDoc(ref(path));
    return snap.exists() ? ({ id: snap.id, ...(snap.data() || {}) } as T) : null;
  } catch (err) {
    return handleError(err, `Failed to read ${path}`);
  }
}

export async function getCollection<T>(
  colPath: ColPath,
  ...constraints: { field: string; op: WhereFilterOp; value: unknown }[]
): Promise<T[]> {
  try {
    const constraintsList = constraints.map((c) => where(c.field, c.op, c.value));
    const q = constraintsList.length ? query(colRef(colPath), ...constraintsList) : colRef(colPath);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) } as T));
  } catch (err) {
    return handleError(err, `Failed to read ${colPath}`);
  }
}

export async function setDocument(path: DocPath, data: Record<string, unknown>): Promise<void> {
  try {
    await setDoc(ref(path), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    return handleError(err, `Failed to write ${path}`);
  }
}

export async function updateDocument(path: DocPath, data: Record<string, unknown>): Promise<void> {
  try {
    await updateDoc(ref(path), { ...data, updatedAt: serverTimestamp() });
  } catch (err) {
    return handleError(err, `Failed to update ${path}`);
  }
}

export async function removeDocument(path: DocPath): Promise<void> {
  try {
    await deleteDoc(ref(path));
  } catch (err) {
    return handleError(err, `Failed to delete ${path}`);
  }
}

export async function addDocument(colPath: ColPath, data: Record<string, unknown>): Promise<string> {
  try {
    const docRef = await addDoc(colRef(colPath), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return docRef.id;
  } catch (err) {
    return handleError(err, `Failed to create in ${colPath}`);
  }
}

export function listenDocument<T>(path: DocPath, cb: (data: T | null) => void): () => void {
  const unsub = onSnapshot(ref(path), (snap: any) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null);
  }, (err: unknown) => {
    console.error(`Snapshot error for ${path}:`, err);
    cb(null);
  });
  return unsub;
}

export function listenCollection<T>(
  colPath: ColPath,
  cb: (data: T[]) => void,
  ...constraints: QueryConstraint[]
): () => void {
  const q = constraints.length ? query(colRef(colPath), ...constraints) : colRef(colPath);
  const unsub = onSnapshot(q, (snap: any) => {
    cb(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as T)));
  }, (err: unknown) => {
    console.error(`Snapshot error for ${colPath}:`, err);
  });
  return unsub;
}
