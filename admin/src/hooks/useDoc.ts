import { useEffect, useState } from "react";
import { listenDocument } from "../lib/firestore";

export function useDoc<T>(docPath: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docPath) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsub = listenDocument<T>(docPath, (doc) => {
        setData(doc);
        setLoading(false);
      });
      return unsub;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load document");
      setLoading(false);
    }
  }, [docPath]);

  return { data, loading, error };
}
