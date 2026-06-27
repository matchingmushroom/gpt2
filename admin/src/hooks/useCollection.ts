import { useEffect, useState } from "react";
import { type QueryConstraint } from "firebase/firestore";
import { listenCollection } from "../lib/firestore";

export function useCollection<T>(
  collectionPath: string | null,
  ...constraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionPath) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsub = listenCollection<T>(
        collectionPath,
        (items) => {
          setData(items);
          setLoading(false);
        },
        ...constraints
      );
      return unsub;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load collection");
      setLoading(false);
    }
  }, [collectionPath, JSON.stringify(constraints)]);

  return { data, loading, error };
}
