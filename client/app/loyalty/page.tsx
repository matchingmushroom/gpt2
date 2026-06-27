"use client";

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { COUNTRY_CODES, DEFAULT_CODE, combinePhone } from "@/lib/phone";

interface LoyaltyAccount {
  phone: string;
  name: string;
  pointsBalance: number;
  totalEarned: number;
  totalRedeemed: number;
}

interface LoyaltyTxn {
  type: string;
  points: number;
  description: string;
  createdAt: any;
}

export default function LoyaltyPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_CODE);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [txns, setTxns] = useState<LoyaltyTxn[]>([]);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(clean)) { setError("Enter a valid 10-digit mobile number"); return; }
    if (!name.trim()) { setError("Enter your name"); return; }
    const fullPhone = combinePhone(countryCode, clean);
    setError("");
    setSearched(true);
    setLoading(true);
    setAccount(null);
    setTxns([]);

    try {
      const snap = await getDoc(doc(db, "loyaltyAccounts", fullPhone));
      if (!snap.exists()) {
        setAccount(null);
        setLoading(false);
        return;
      }
      const data = snap.data() as LoyaltyAccount;
      if (data.name?.toLowerCase() !== name.trim().toLowerCase()) {
        setAccount(null);
        setLoading(false);
        return;
      }
      setAccount({ ...data, phone: fullPhone });

      const txnQuery = query(
        collection(db, "loyaltyTransactions"),
        where("phone", "==", fullPhone),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const txnSnap = await getDocs(txnQuery);
      setTxns(txnSnap.docs.map((d) => d.data() as LoyaltyTxn));
    } catch (err) {
      console.error("Loyalty lookup failed:", err);
    }
    setLoading(false);
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-2 font-heading text-2xl font-bold text-text">Loyalty Program</h1>
        <p className="mb-6 text-sm text-text-light">Earn points on every purchase and redeem them for discounts.</p>

        <div className="mb-6 rounded-card bg-forest-green/5 border border-forest-green/20 p-4 text-sm">
          <h3 className="font-semibold text-forest-green mb-2">How it works</h3>
          <ul className="space-y-1 text-text-light">
            <li>✦ Earn 1 point for every Rs 100 spent</li>
            <li>✦ 1 point = Rs 1 discount on your next order</li>
            <li>✦ Minimum 100 points required to redeem</li>
            <li>✦ Points are credited when payment is received</li>
          </ul>
        </div>

        <form onSubmit={handleSearch} className="rounded-card bg-white p-4 shadow-card sm:p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-input border border-border px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-green" placeholder="Your name as registered" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-text">Phone Number</label>
              <div className="flex gap-2">
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-28 shrink-0 rounded-input border border-border px-2 py-2.5 text-sm outline-none transition-colors focus:border-forest-green">
                  {COUNTRY_CODES.map((cc) => (
                    <option key={cc.code} value={cc.code}>{cc.label}</option>
                  ))}
                </select>
                <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className="flex-1 rounded-input border border-border px-4 py-2.5 text-sm outline-none transition-colors focus:border-forest-green" placeholder="98XXXXXXXX" required />
              </div>
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
            <button type="submit" className="w-full rounded-btn bg-forest-green py-2.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-forest-green-dark">
              {loading ? "Checking..." : "Check Points"}
            </button>
          </div>
        </form>

        {searched && !loading && !account && (
          <div className="mt-6 rounded-card bg-white p-4 text-center shadow-card sm:p-6">
            <p className="text-4xl">🥒</p>
            <p className="mt-3 text-text-light">No loyalty account found for this name and phone. Start shopping to earn points!</p>
          </div>
        )}

        {account && (
          <div className="mt-6 space-y-4">
            <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
              <div className="text-center">
                <p className="text-5xl">⭐</p>
                <p className="mt-2 text-sm text-text-muted">Welcome, {account.name}</p>
                <p className="mt-4 text-4xl font-bold text-forest-green">{account.pointsBalance}</p>
                <p className="text-sm text-text-muted">Available Points</p>
                <div className="mt-4 flex justify-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="font-semibold text-text">{account.totalEarned}</p>
                    <p className="text-xs text-text-muted">Total Earned</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-text">{account.totalRedeemed}</p>
                    <p className="text-xs text-text-muted">Total Redeemed</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-text">Rs {(account.pointsBalance).toLocaleString()}</p>
                    <p className="text-xs text-text-muted">Value in Rs</p>
                  </div>
                </div>
              </div>
            </div>

            {txns.length > 0 && (
              <div className="rounded-card bg-white p-4 shadow-card sm:p-6">
                <h3 className="mb-3 font-heading font-semibold text-text">Recent Activity</h3>
                <div className="divide-y divide-border text-sm">
                  {txns.map((txn, i) => (
                    <div key={i} className="flex items-center justify-between py-2">
                      <div>
                        <span className={`text-xs font-medium ${txn.type === "earn" ? "text-emerald-600" : txn.type === "redeem" ? "text-rose-600" : "text-orange-600"}`}>
                          {txn.type === "earn" ? "Earned" : txn.type === "redeem" ? "Redeemed" : "Adjusted"}
                        </span>
                        <p className="text-xs text-text-muted">{txn.description}</p>
                      </div>
                      <span className={`font-semibold ${txn.points > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {txn.points > 0 ? "+" : ""}{txn.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}