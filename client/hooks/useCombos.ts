"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Combo } from "@/data/comboTypes";

export function useCombos() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDocs(query(collection(db, "combos"), where("isActive", "==", true)))
      .then((snap) => {
        if (!cancelled) {
          setCombos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Combo)));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { combos, loading };
}
