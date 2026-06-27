import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

interface LogParams {
  action: string;
  details: string;
  module: string;
  staffId: string;
  staffName: string;
  relatedDocId?: string;
  undoable?: boolean;
  undoData?: Record<string, unknown>;
}

export async function logActivity(params: LogParams): Promise<void> {
  try {
    await addDoc(collection(db, "activityLog"), {
      action: params.action,
      details: params.details,
      module: params.module,
      performedBy: params.staffId,
      performedByName: params.staffName,
      relatedDocId: params.relatedDocId ?? null,
      undoable: params.undoable ?? false,
      undoData: params.undoData ?? null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
