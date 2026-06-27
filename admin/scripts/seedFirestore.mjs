import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, "..", ".env");
const envContent = readFileSync(envPath, "utf-8");
const apiKey = envContent.match(/VITE_FIREBASE_API_KEY=(.+)/)?.[1]?.trim();
const projectId = envContent.match(/VITE_FIREBASE_PROJECT_ID=(.+)/)?.[1]?.trim();

if (!apiKey || !projectId) { console.error("Missing env vars"); process.exit(1); }

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

let idToken = null;

async function signIn() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "greatpickletaste@gmail.com", password: "admin123", returnSecureToken: true }),
  });
  const data = await res.json();
  if (!data.idToken) { console.error("Auth failed:", data); process.exit(1); }
  idToken = data.idToken;
  console.log("Authenticated:", data.email);
}

function toFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined) continue;
    if (typeof val === "string") {
      fields[key] = { stringValue: val };
    } else if (typeof val === "number") {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === "boolean") {
      fields[key] = { booleanValue: val };
    } else if (val instanceof Date) {
      fields[key] = { timestampValue: val.toISOString() };
    } else if (Array.isArray(val)) {
      const vals = val.map((v) => {
        if (typeof v === "string") return { stringValue: v };
        if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
        if (v instanceof Date) return { timestampValue: v.toISOString() };
        if (typeof v === "object") return { mapValue: { fields: toFields(v) } };
        return { stringValue: String(v) };
      });
      fields[key] = { arrayValue: { values: vals } };
    } else if (typeof val === "object") {
      fields[key] = { mapValue: { fields: toFields(val) } };
    }
  }
  return fields;
}

async function createDoc(collection, id, data) {
  const url = id
    ? `${FIRESTORE_URL}/${collection}?documentId=${id}`
    : `${FIRESTORE_URL}/${collection}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAILED ${collection}/${id || ""}:`, err.slice(0, 150));
    return null;
  }
  const body = await res.json();
  console.log(`  Created ${collection}/${body.name?.split("/").pop() || id}`);
  return body;
}

async function ensureDoc(collection, id, data) {
  const res = await fetch(`${FIRESTORE_URL}/${collection}/${id}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.ok) {
    console.log(`  Exists ${collection}/${id}`);
    return true;
  }
  return await createDoc(collection, id, data);
}

async function deleteCollection(collection) {
  const res = await fetch(`${FIRESTORE_URL}/${collection}?pageSize=500`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return;
  const data = await res.json();
  if (!data.documents) return;
  for (const doc of data.documents) {
    const name = doc.name;
    await fetch(name, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
    console.log(`  Deleted ${name}`);
  }
  // get next batch
  if (data.nextPageToken) {
    const res2 = await fetch(`${FIRESTORE_URL}/${collection}?pageToken=${data.nextPageToken}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data2 = await res2.json();
    if (data2.documents) {
      for (const doc of data2.documents) {
        await fetch(doc.name, { method: "DELETE", headers: { Authorization: `Bearer ${idToken}` } });
      }
    }
  }
}

async function seed() {
  console.log("\n=== SEEDING FIREBASE ===\n");
  await signIn();

  // Helper to get BS timestamps (AD dates that look realistic)
  const d = (y, m, day) => new Date(y, m - 1, day);
  const ts = (y, m, day) => d(y, m, day);

  // ========== SETTINGS ==========
  console.log("\n--- Store Settings ---");
  const storeSettings = {
    storeName: "Great Pickle Taste",
    tagline: "Homemade Nepali Pickles, Made with Love",
    logoUrl: null,
    primaryColor: "#1F5E3B",
    secondaryColor: "#D8A326",
    phone: "+977-9851234567",
    email: "hello@greatpickletaste.com",
    address: "Kathmandu, Nepal",
    socialLinks: { facebook: "https://facebook.com/greatpickletaste", instagram: "https://instagram.com/greatpickletaste", youtube: null },
    panNumber: "123456789",
    invoiceTerms: "Payment due within 15 days. Please make payment via bank transfer or eSewa.",
    invoiceFooter: "Thank you for supporting homemade Nepali pickles!",
    domain: "greatpickletaste.com",
    whatsappNumber: "+977-9851234567",
    updatedAt: new Date(),
  };
  await ensureDoc("settings", "store", storeSettings);

  console.log("\n--- Payment Settings ---");
  await ensureDoc("settings", "payment", {
    esewa: { enabled: true, merchantId: "GPT-ESEWA-001" },
    khalti: { enabled: true, publicKey: "test_public_key", secretKey: "test_secret_key" },
    cod: { enabled: true, maxOrderAmount: 5000 },
    updatedAt: new Date(),
  });

  console.log("\n--- Delivery Settings ---");
  await ensureDoc("settings", "delivery", {
    deliveryCharge: 50, freeDeliveryThreshold: 500, serviceArea: ["Kathmandu", "Lalitpur", "Bhaktapur"], maxDeliveryDays: 3, updatedAt: new Date(),
  });

  console.log("\n--- Notification Settings ---");
  await ensureDoc("settings", "notifications", {
    whatsappBusinessNumber: "+977-9851234567", emailNotifications: ["hello@greatpickletaste.com"], notifyOnNewOrder: true, notifyOnLowStock: true, lowStockThreshold: 20, updatedAt: new Date(),
  });

  console.log("\n--- Credit Settings ---");
  await ensureDoc("settings", "credit", {
    creditEnabled: true, maxCreditPerCustomer: 10000, overdueWarningDays: 7, overdueDangerDays: 30, updatedAt: new Date(),
  });

  console.log("\n--- Backup Settings ---");
  await ensureDoc("settings", "backup", {
    gasUrl: "https://script.google.com/macros/s/AKfycbxN8B7n2VDf_8k9EqS5Qm6Xy3zP4zP4zP4zP4z/exec",
    lastBackupAt: null, autoBackupEnabled: false, updatedAt: new Date(),
  });

  console.log("\n--- Budget Settings ---");
  await ensureDoc("settings", "budget", {
    categories: {
      Rent: { mode: "limit", limit: 25000 },
      Electricity: { mode: "limit", limit: 5000 },
      Wages: { mode: "track", limit: null },
      Marketing: { mode: "limit", limit: 10000 },
      Packaging: { mode: "track", limit: null },
      Transport: { mode: "track", limit: null },
    },
    updatedAt: new Date(),
  });

  // ========== CATEGORIES ==========
  console.log("\n--- Categories ---");
  const catData = [
    { id: "cat-nonveg", name: "Non-Veg Pickles", slug: "non-veg", parentId: null, description: "Meat-based traditional pickles", image: "🍖", sortOrder: 1 },
    { id: "cat-buff", name: "Buff Pickles", slug: "buff", parentId: "cat-nonveg", description: "Buffalo meat pickles", image: "🥩", sortOrder: 2 },
    { id: "cat-chicken", name: "Chicken Pickles", slug: "chicken", parentId: "cat-nonveg", description: "Chicken meat pickles", image: "🍗", sortOrder: 3 },
    { id: "cat-pork", name: "Pork Pickles", slug: "pork", parentId: "cat-nonveg", description: "Pork meat pickles", image: "🥓", sortOrder: 4 },
    { id: "cat-fish", name: "Fish Pickles", slug: "fish", parentId: "cat-nonveg", description: "Fish-based pickles", image: "🐟", sortOrder: 5 },
    { id: "cat-veg", name: "Veg Pickles", slug: "veg", parentId: null, description: "Vegetable-based pickles", image: "🥬", sortOrder: 6 },
    { id: "cat-mixedveg", name: "Mixed Vegetable", slug: "mixed-veg", parentId: "cat-veg", description: "Mixed vegetable pickles", image: "🥕", sortOrder: 7 },
    { id: "cat-radish", name: "Radish Pickles", slug: "radish", parentId: "cat-veg", description: "Mula-based pickles", image: "🌶️", sortOrder: 8 },
    { id: "cat-ginger", name: "Ginger Pickles", slug: "ginger", parentId: "cat-veg", description: "Ginger-based pickles", image: "🫚", sortOrder: 9 },
    { id: "cat-fruit", name: "Fruit Pickles", slug: "fruit", parentId: null, description: "Fruit-based sweet and tangy pickles", image: "🍎", sortOrder: 10 },
    { id: "cat-lapsi", name: "Lapsi Pickles", slug: "lapsi", parentId: "cat-fruit", description: "Hog plum pickles", image: "🫒", sortOrder: 11 },
    { id: "cat-amla", name: "Amla Pickles", slug: "amla", parentId: "cat-fruit", description: "Gooseberry pickles", image: "🫐", sortOrder: 12 },
    { id: "cat-special", name: "Specialty", slug: "specialty", parentId: null, description: "Special and seasonal pickles", image: "⭐", sortOrder: 13 },
  ];
  const catIds = {};
  for (const c of catData) {
    const { id, ...rest } = c;
    await ensureDoc("categories", id, { ...rest, isActive: true, createdAt: ts(2025, 1, 1), updatedAt: ts(2025, 1, 1) });
    catIds[id] = id;
  }

  // ========== PRODUCTS & SKUs ==========
  console.log("\n--- Products & SKUs ---");
  const products = [
    {
      id: "prod-buff", name: "Buff Achar", slug: "buff-achar", description: "Traditional Nepali-style spicy buffalo pickle, slow-cooked with mustard oil and Himalayan spices.",
      categoryIds: ["cat-nonveg", "cat-buff"], tags: ["spicy", "traditional", "meat"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1603073163308-9654c3fb70b5?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "BUFF-300", label: "300 gm", weightInGrams: 300, price: 120, unit: "gm" },
        { skuCode: "BUFF-500", label: "500 gm", weightInGrams: 500, price: 200, unit: "gm" },
        { skuCode: "BUFF-1K", label: "1 kg", weightInGrams: 1000, price: 350, unit: "kg" },
      ],
    },
    {
      id: "prod-chicken", name: "Chicken Achar", slug: "chicken-achar", description: "Tender chicken pieces marinated in tangy mustard and pickling spices.",
      categoryIds: ["cat-nonveg", "cat-chicken"], tags: ["spicy", "chicken", "traditional"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "CHK-300", label: "300 gm", weightInGrams: 300, price: 150, unit: "gm" },
        { skuCode: "CHK-500", label: "500 gm", weightInGrams: 500, price: 250, unit: "gm" },
      ],
    },
    {
      id: "prod-pork", name: "Pork Achar", slug: "pork-achar", description: "Succulent pork cooked with Timur (Sichuan pepper), garlic, and mustard oil.",
      categoryIds: ["cat-nonveg", "cat-pork"], tags: ["spicy", "timur", "meat"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "PORK-300", label: "300 gm", weightInGrams: 300, price: 180, unit: "gm" },
        { skuCode: "PORK-500", label: "500 gm", weightInGrams: 500, price: 300, unit: "gm" },
      ],
    },
    {
      id: "prod-fish", name: "Fish Achar", slug: "fish-achar", description: "Smoked fish pickle with mustard seeds and turmeric. A coastal Nepali favorite.",
      categoryIds: ["cat-nonveg", "cat-fish"], tags: ["smoked", "fish", "traditional"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "FISH-300", label: "300 gm", weightInGrams: 300, price: 160, unit: "gm" },
        { skuCode: "FISH-500", label: "500 gm", weightInGrams: 500, price: 270, unit: "gm" },
      ],
    },
    {
      id: "prod-mula", name: "Mula ko Achar", slug: "mula-ko-achar", description: "Crispy radish pickle with fiery kick. Made from sun-dried radish, mustard seeds, and chili.",
      categoryIds: ["cat-veg", "cat-radish"], tags: ["spicy", "radish", "traditional"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "MULA-300", label: "300 gm", weightInGrams: 300, price: 100, unit: "gm" },
        { skuCode: "MULA-500", label: "500 gm", weightInGrams: 500, price: 170, unit: "gm" },
        { skuCode: "MULA-1K", label: "1 kg", weightInGrams: 1000, price: 300, unit: "kg" },
      ],
    },
    {
      id: "prod-mixveg", name: "Mix Vegetable Achar", slug: "mix-veg-achar", description: "Colorful medley of cauliflower, carrot, green beans, and peas pickled in aromatic spices.",
      categoryIds: ["cat-veg", "cat-mixedveg"], tags: ["mixed", "vegetable", "mild"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "MIX-300", label: "300 gm", weightInGrams: 300, price: 90, unit: "gm" },
        { skuCode: "MIX-500", label: "500 gm", weightInGrams: 500, price: 150, unit: "gm" },
      ],
    },
    {
      id: "prod-ginger", name: "Ginger Achar", slug: "ginger-achar", description: "Thinly sliced young ginger pickled in lemon juice and mustard seeds.",
      categoryIds: ["cat-veg", "cat-ginger"], tags: ["ginger", "digestive", "mild"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "GIN-200", label: "200 gm", weightInGrams: 200, price: 80, unit: "gm" },
        { skuCode: "GIN-300", label: "300 gm", weightInGrams: 300, price: 110, unit: "gm" },
      ],
    },
    {
      id: "prod-lapsi", name: "Lapsi Achar", slug: "lapsi-achar", description: "Sweet and tangy hog plum pickle, a Nepali delicacy. Slow-cooked with jaggery and roasted spices.",
      categoryIds: ["cat-fruit", "cat-lapsi"], tags: ["sweet", "tangy", "fruit"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1590179068383-b9c69aacebd5?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "LAP-300", label: "300 gm", weightInGrams: 300, price: 110, unit: "gm" },
        { skuCode: "LAP-500", label: "500 gm", weightInGrams: 500, price: 190, unit: "gm" },
      ],
    },
    {
      id: "prod-amla", name: "Amla Achar", slug: "amla-achar", description: "Vitamin C-rich gooseberry pickle with perfect balance of sour, salty, and spicy.",
      categoryIds: ["cat-fruit", "cat-amla"], tags: ["sour", "healthy", "vitamin-c"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "AML-300", label: "300 gm", weightInGrams: 300, price: 100, unit: "gm" },
        { skuCode: "AML-500", label: "500 gm", weightInGrams: 500, price: 170, unit: "gm" },
      ],
    },
    {
      id: "prod-timur", name: "Timur Ko Achar", slug: "timur-achar", description: "Nepali Sichuan pepper pickle with garlic and ginger. Numbing, aromatic, and addictive.",
      categoryIds: ["cat-special"], tags: ["timur", "sichuan", "numbing"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1583066397570-1b9f9e7cc30d?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "TIM-200", label: "200 gm", weightInGrams: 200, price: 130, unit: "gm" },
        { skuCode: "TIM-300", label: "300 gm", weightInGrams: 300, price: 190, unit: "gm" },
      ],
    },
    {
      id: "prod-mushroom", name: "Mushroom Achar", slug: "mushroom-achar", description: "Earthy mushrooms pickled in mustard oil with fenugreek and chili flakes.",
      categoryIds: ["cat-veg", "cat-mixedveg"], tags: ["mushroom", "earthy", "mustard"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "MSH-300", label: "300 gm", weightInGrams: 300, price: 130, unit: "gm" },
        { skuCode: "MSH-500", label: "500 gm", weightInGrams: 500, price: 220, unit: "gm" },
      ],
    },
    {
      id: "prod-cauliflower", name: "Cauliflower Achar", slug: "cauli-achar", description: "Crispy cauliflower florets in tangy turmeric and mustard pickling sauce.",
      categoryIds: ["cat-veg", "cat-mixedveg"], tags: ["cauliflower", "crispy", "turmeric"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "CAULI-300", label: "300 gm", weightInGrams: 300, price: 95, unit: "gm" },
        { skuCode: "CAULI-500", label: "500 gm", weightInGrams: 500, price: 160, unit: "gm" },
      ],
    },
    {
      id: "prod-soybean", name: "Soybean Achar", slug: "soybean-achar", description: "Protein-packed soybean pickle with ginger, garlic, and chili.",
      categoryIds: ["cat-veg"], tags: ["soybean", "protein", "vegan"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "SOY-200", label: "200 gm", weightInGrams: 200, price: 85, unit: "gm" },
        { skuCode: "SOY-300", label: "300 gm", weightInGrams: 300, price: 120, unit: "gm" },
      ],
    },
    {
      id: "prod-garlic", name: "Garlic Achar", slug: "garlic-achar", description: "Whole garlic cloves fermented in mustard oil and Himalayan spices.",
      categoryIds: ["cat-special"], tags: ["garlic", "fermented", "antibacterial"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1587049352910-5e10c255d9a6?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "GAR-200", label: "200 gm", weightInGrams: 200, price: 100, unit: "gm" },
        { skuCode: "GAR-300", label: "300 gm", weightInGrams: 300, price: 150, unit: "gm" },
      ],
    },
    {
      id: "prod-tomato", name: "Tomato Achar", slug: "tomato-achar", description: "Smoky roasted tomato pickle with sesame seeds and mustard oil.",
      categoryIds: ["cat-veg", "cat-mixedveg"], tags: ["tomato", "smoky", "roasted"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "TOM-300", label: "300 gm", weightInGrams: 300, price: 90, unit: "gm" },
        { skuCode: "TOM-500", label: "500 gm", weightInGrams: 500, price: 150, unit: "gm" },
      ],
    },
    {
      id: "prod-lemon", name: "Lemon Achar", slug: "lemon-achar", description: "Preserved lemons in Himalayan salt and spice mix. Perfect with dal bhat.",
      categoryIds: ["cat-fruit"], tags: ["lemon", "preserved", "salty"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1590502593747-42a996133562?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "LEM-200", label: "200 gm", weightInGrams: 200, price: 80, unit: "gm" },
        { skuCode: "LEM-300", label: "300 gm", weightInGrams: 300, price: 120, unit: "gm" },
      ],
    },
    {
      id: "prod-coriander", name: "Coriander Achar", slug: "coriander-achar", description: "Fresh coriander leaves and stems pickled with green chili and lemon.",
      categoryIds: ["cat-veg"], tags: ["coriander", "fresh", "green"], isFeatured: false,
      images: ["https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "COR-200", label: "200 gm", weightInGrams: 200, price: 70, unit: "gm" },
        { skuCode: "COR-300", label: "300 gm", weightInGrams: 300, price: 100, unit: "gm" },
      ],
    },
    {
      id: "prod-szechuan", name: "Szechuan Achar", slug: "szechuan-achar", description: "Extra-spicy Szechuan-style pickle with dried red chilies and garlic.",
      categoryIds: ["cat-special"], tags: ["spicy", "szechuan", "extra-hot"], isFeatured: true,
      images: ["https://images.unsplash.com/photo-1563379926898-05f4575a45d8?w=600&h=600&fit=crop"],
      skus: [
        { skuCode: "SZE-200", label: "200 gm", weightInGrams: 200, price: 110, unit: "gm" },
        { skuCode: "SZE-300", label: "300 gm", weightInGrams: 300, price: 170, unit: "gm" },
      ],
    },
  ];

  const prodIds = {};
  for (const p of products) {
    const { id, skus, ...rest } = p;
    let exists = await ensureDoc("products", id, {
      ...rest,
      isActive: true,
      createdAt: ts(2025, 2, 1),
      updatedAt: ts(2025, 2, 1),
    });
    if (exists === true) {
      // still create subcollection docs
    }
    // Create SKUs in subcollection
    for (const sku of skus) {
      await createDoc(`products/${id}/skus`, `${id}-${sku.skuCode}`, {
        ...sku,
        isActive: true,
        createdAt: ts(2025, 2, 1),
      });
    }
    prodIds[id] = id;
    console.log(`  + ${skuCount(skus)} SKUs for ${p.name}`);
  }
  function skuCount(s) { return s.length; }

  // ========== STAFF ==========
  console.log("\n--- Staff ---");
  const staffMembers = [
    { id: "staff-manager", name: "Sita Sharma", email: "sita@greatpickletaste.com", phone: "+977-9841234567", role: "manager" },
    { id: "staff-staff", name: "Ram Pandey", email: "ram@greatpickletaste.com", phone: "+977-9857654321", role: "staff" },
    { id: "staff-viewer", name: "Gita Thapa", email: "gita@greatpickletaste.com", phone: "+977-9861122334", role: "viewer" },
  ];

  function rolePermissions(role) {
    const full = { read: true, write: true, delete: true };
    const rw = { read: true, write: true };
    const ro = { read: true, write: false };
    const deny = { read: false, write: false };
    switch (role) {
      case "super_admin":
        return {
          products: full, categories: full, orders: full, batches: full,
          purchases: full, suppliers: full, expenses: full, staff: full, coupons: full, debtors: full, creditors: full,
          reports: full, settings: full, logs: { read: true },
        };
      case "manager":
        return {
          products: rw, categories: rw, orders: { read: true, write: true, delete: false }, batches: rw,
          purchases: rw, suppliers: rw, expenses: rw, staff: ro, coupons: rw, debtors: rw, creditors: rw,
          reports: rw, settings: ro, logs: { read: true },
        };
      case "staff":
        return {
          products: rw, categories: ro, orders: { read: true, write: true, delete: false }, batches: ro,
          purchases: ro, suppliers: ro, expenses: rw, staff: deny, coupons: ro, debtors: ro, creditors: ro,
          reports: ro, settings: deny, logs: { read: false },
        };
      case "viewer":
        return {
          products: ro, categories: ro, orders: ro, batches: ro,
          purchases: ro, suppliers: ro, expenses: ro, staff: deny, coupons: ro, debtors: ro, creditors: ro,
          reports: ro, settings: deny, logs: { read: false },
        };
    }
  }

  // We already have super_admin - don't override, just ensure others
  for (const s of staffMembers) {
    await ensureDoc("staff", s.id, {
      uid: s.id, ...s, role: s.role, permissions: rolePermissions(s.role),
      isActive: true, createdAt: ts(2025, 1, 15), updatedAt: ts(2025, 1, 15),
    });
  }

  // ========== COUPONS ==========
  console.log("\n--- Coupons ---");
  const coupons = [
    { id: "coup-welcome", code: "WELCOME10", type: "percentage", value: 10, minOrderAmount: 300, maxUses: 100, currentUses: 23, validFrom: ts(2025, 1, 1), validUntil: ts(2026, 1, 1), applicableSkuIds: [], isActive: true },
    { id: "coup-festive", code: "FESTIVE20", type: "percentage", value: 20, minOrderAmount: 500, maxUses: 50, currentUses: 8, validFrom: ts(2025, 9, 1), validUntil: ts(2025, 10, 31), applicableSkuIds: [], isActive: true },
    { id: "coup-sample", code: "SAMPLE", type: "full_discount", value: 100, minOrderAmount: 0, maxUses: 30, currentUses: 15, validFrom: ts(2025, 1, 1), validUntil: ts(2025, 12, 31), applicableSkuIds: [], isActive: true },
    { id: "coup-buff50", code: "BUFF50", type: "fixed", value: 50, minOrderAmount: 200, maxUses: 20, currentUses: 5, validFrom: ts(2025, 6, 1), validUntil: ts(2025, 8, 31), applicableSkuIds: [], isActive: true },
  ];
  for (const c of coupons) {
    const { id, ...rest } = c;
    await ensureDoc("coupons", id, { ...rest, createdBy: "staff-manager", createdAt: ts(2025, 1, 1), updatedAt: ts(2025, 1, 1) });
  }

  // ========== ORDERS ==========
  console.log("\n--- Orders ---");
  const orderStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
  const customers = [
    { name: "Anjali Adhikari", phone: "+977-9812345678", email: "anjali@gmail.com", address: "Baneshwor, Kathmandu" },
    { name: "Binod Karki", phone: "+977-9823456789", email: "binod@outlook.com", address: "Jawalakhel, Lalitpur" },
    { name: "Chandra Rai", phone: "+977-9834567890", email: "chandra@yahoo.com", address: "Suryabinayak, Bhaktapur" },
    { name: "Deepa Gurung", phone: "+977-9845678901", email: "deepa@gmail.com", address: "Thamel, Kathmandu" },
    { name: "Ekaraj Shrestha", phone: "+977-9856789012", email: "ekaraj@hotmail.com", address: "Patan Durbar Square, Lalitpur" },
    { name: "Fula Devi", phone: "+977-9867890123", email: "fula@gmail.com", address: "Koteshwor, Kathmandu" },
    { name: "Ganesh Poudel", phone: "+977-9878901234", email: "ganesh@proton.me", address: "Boudha, Kathmandu" },
    { name: "Hari Subedi", phone: "+977-9889012345", email: "hari@gmail.com", address: "Basantapur, Kathmandu" },
    { name: "Indira Bhatta", phone: "+977-9890123456", email: "indira@outlook.com", address: "Maharajgunj, Kathmandu" },
    { name: "Janak Acharya", phone: "+977-9801234567", email: "janak@gmail.com", address: "Chabahil, Kathmandu" },
    { name: "Kiran Thakur", phone: "+977-9811122334", email: "kiran@gmail.com", address: "Balkumari, Lalitpur" },
    { name: "Laxmi Neupane", phone: "+977-9822233445", email: "laxmi@yahoo.com", address: "Gongabu, Kathmandu" },
  ];
  const paymentMethods = ["esewa", "khalti", "cod", "cash", "bank"];
  const productList = Object.values(prodIds);

  // Build a SKU lookup
  const allSkus = [];
  for (const p of products) {
    const mainImg = p.images?.[0] || "🥫";
    for (const sku of p.skus) {
      allSkus.push({ productId: p.id, productName: p.name, skuId: `${p.id}-${sku.skuCode}`, skuLabel: sku.label, skuCode: sku.skuCode, price: sku.price, weight: sku.weightInGrams, image: mainImg, slug: p.slug });
    }
  }

  function randomItems() {
    const count = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...allSkus].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);
    return selected.map((s) => ({
      skuId: s.skuId,
      productName: s.productName,
      skuLabel: s.skuLabel,
      quantity: 1 + Math.floor(Math.random() * 3),
      unitPrice: s.price,
      subtotal: 0, // computed below
    }));
  }

  for (let i = 0; i < 25; i++) {
    const cust = customers[i % customers.length];
    const items = randomItems();
    const subtotal = items.reduce((sum, item) => {
      item.subtotal = item.unitPrice * item.quantity;
      return sum + item.subtotal;
    }, 0);
    const deliveryCharge = subtotal >= 500 ? 0 : 50;
    const discount = Math.random() > 0.7 ? Math.round(subtotal * 0.1) : 0;
    const grandTotal = subtotal + deliveryCharge - discount;
    const statusIdx = Math.min(i, orderStatuses.length - 1);
    const status = orderStatuses[statusIdx];
    const paymentStatus = status === "cancelled" || status === "pending" ? "unpaid" : "paid";
    const payMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const daysAgo = i * 3 + Math.floor(Math.random() * 3);
    const orderDate = new Date(Date.now() - daysAgo * 86400000);
    const today = new Date();

    const orderData = {
      orderNumber: `ORD-2082-${String(1001 + i).padStart(4, "0")}`,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: cust.email,
      shippingAddress: cust.address,
      deliveryNotes: i % 3 === 0 ? "Please leave at the gate" : "",
      items,
      subtotal,
      discount,
      deliveryCharge,
      grandTotal,
      coupon: { code: null, type: null, discountAmount: 0, appliedBy: null, appliedByName: null },
      issuedCoupon: null,
      paymentMethod: payMethod,
      paymentStatus,
      paymentId: payMethod !== "cod" ? `PAY-${String(9000 + i).padStart(4, "0")}` : null,
      paidAt: paymentStatus === "paid" ? orderDate : null,
      paymentHistory: paymentStatus === "paid" ? [{ method: payMethod, amount: grandTotal, receivedBy: "staff-manager", receivedByName: "Sita Sharma", receivedAt: orderDate, note: "Payment received" }] : [],
      status,
      statusHistory: [{ status: "pending", changedBy: "customer", changedByName: cust.name, timestamp: orderDate, note: "Order placed" }],
      deliveredAt: status === "delivered" ? new Date(orderDate.getTime() + 3 * 86400000) : null,
      returnedAt: null,
      returnReason: null,
      deliveryPartner: status === "shipped" || status === "delivered" ? "Pathao Delivery" : null,
      trackingUrl: null,
      notes: "",
      createdBy: "customer",
      createdAt: orderDate,
      updatedAt: today,
    };

    const orderId = `order-${String(1001 + i).padStart(4, "0")}`;
    await createDoc("orders", orderId, orderData);
  }

  // ========== BATCHES ==========
  console.log("\n--- Batches ---");
  const batchData = [
    { batchNumber: "BAT-2082-001", productId: "prod-buff", productName: "Buff Achar", items: [{ skuId: "prod-buff-BUFF-500", skuCode: "BUFF-500", label: "500 gm", quantity: 20, unitCost: 140 }], totalCost: 2800, notes: "Summer batch #1", status: "completed" },
    { batchNumber: "BAT-2082-002", productId: "prod-chicken", productName: "Chicken Achar", items: [{ skuId: "prod-chicken-CHK-300", skuCode: "CHK-300", label: "300 gm", quantity: 30, unitCost: 100 }, { skuId: "prod-chicken-CHK-500", skuCode: "CHK-500", label: "500 gm", quantity: 15, unitCost: 170 }], totalCost: 5550, notes: "After Dashain batch", status: "completed" },
    { batchNumber: "BAT-2082-003", productId: "prod-mula", productName: "Mula ko Achar", items: [{ skuId: "prod-mula-MULA-300", skuCode: "MULA-300", label: "300 gm", quantity: 50, unitCost: 60 }, { skuId: "prod-mula-MULA-500", skuCode: "MULA-500", label: "500 gm", quantity: 30, unitCost: 100 }], totalCost: 6000, notes: "Radish season", status: "completed" },
    { batchNumber: "BAT-2082-004", productId: "prod-mixveg", productName: "Mix Vegetable Achar", items: [{ skuId: "prod-mixveg-MIX-300", skuCode: "MIX-300", label: "300 gm", quantity: 40, unitCost: 55 }], totalCost: 2200, notes: "Fresh veg batch", status: "completed" },
    { batchNumber: "BAT-2082-005", productId: "prod-lapsi", productName: "Lapsi Achar", items: [{ skuId: "prod-lapsi-LAP-300", skuCode: "LAP-300", label: "300 gm", quantity: 25, unitCost: 70 }], totalCost: 1750, notes: "Lapsi season special", status: "in_progress" },
    { batchNumber: "BAT-2082-006", productId: "prod-timur", productName: "Timur Ko Achar", items: [{ skuId: "prod-timur-TIM-200", skuCode: "TIM-200", label: "200 gm", quantity: 20, unitCost: 85 }], totalCost: 1700, notes: "Timur harvest batch", status: "completed" },
    { batchNumber: "BAT-2082-007", productId: "prod-pork", productName: "Pork Achar", items: [{ skuId: "prod-pork-PORK-300", skuCode: "PORK-300", label: "300 gm", quantity: 15, unitCost: 120 }], totalCost: 1800, notes: "Limited batch", status: "completed" },
    { batchNumber: "BAT-2082-008", productId: "prod-szechuan", productName: "Szechuan Achar", items: [{ skuId: "prod-szechuan-SZE-200", skuCode: "SZE-200", label: "200 gm", quantity: 25, unitCost: 70 }], totalCost: 1750, notes: "New recipe test batch", status: "completed" },
  ];

  for (const b of batchData) {
    const { items, ...rest } = b;
    await createDoc("batches", `batch-${b.batchNumber}`, {
      ...rest,
      items: items.map((item) => ({ ...item, unitCost: item.unitCost })),
      linkedPurchaseId: null,
      createdBy: "staff-manager",
      createdAt: ts(2025, 3, 1 + Math.floor(Math.random() * 60)),
      updatedAt: ts(2025, 3, 1 + Math.floor(Math.random() * 60)),
    });
  }

  // ========== PURCHASES ==========
  console.log("\n--- Purchases ---");
  const suppliers = [
    { name: "Himalayan Spice Traders", phone: "+977-9811112222", address: "Kalimati, Kathmandu" },
    { name: "Kathmandu Meat Supply", phone: "+977-9822223333", address: "Balkhu, Kathmandu" },
    { name: "Fresh Valley Vegetables", phone: "+977-9833334444", address: "Kirtipur, Kathmandu" },
    { name: "Eastern Oil Mills", phone: "+977-9844445555", address: "Biratnagar, Morang" },
    { name: "Organic Farm Nepal", phone: "+977-9855556666", address: "Dhulikhel, Kavre" },
  ];

  const purchaseItems = [
    [{ materialName: "Mustard Oil", quantity: 20, unit: "liter", unitPrice: 250, totalPrice: 5000 }, { materialName: "Red Chili Powder", quantity: 10, unit: "kg", unitPrice: 400, totalPrice: 4000 }, { materialName: "Salt (Himalayan)", quantity: 15, unit: "kg", unitPrice: 80, totalPrice: 1200 }],
    [{ materialName: "Chicken (diced)", quantity: 25, unit: "kg", unitPrice: 350, totalPrice: 8750 }, { materialName: "Garlic", quantity: 5, unit: "kg", unitPrice: 300, totalPrice: 1500 }, { materialName: "Ginger", quantity: 5, unit: "kg", unitPrice: 200, totalPrice: 1000 }],
    [{ materialName: "Buffalo Meat", quantity: 30, unit: "kg", unitPrice: 280, totalPrice: 8400 }, { materialName: "Mustard Seeds", quantity: 8, unit: "kg", unitPrice: 180, totalPrice: 1440 }],
    [{ materialName: "Pork Meat", quantity: 20, unit: "kg", unitPrice: 320, totalPrice: 6400 }, { materialName: "Timur (Sichuan Pepper)", quantity: 3, unit: "kg", unitPrice: 1200, totalPrice: 3600 }],
    [{ materialName: "Radish", quantity: 40, unit: "kg", unitPrice: 40, totalPrice: 1600 }, { materialName: "Green Chili", quantity: 10, unit: "kg", unitPrice: 150, totalPrice: 1500 }, { materialName: "Fenugreek Seeds", quantity: 4, unit: "kg", unitPrice: 120, totalPrice: 480 }],
    [{ materialName: "Mixed Vegetables", quantity: 35, unit: "kg", unitPrice: 60, totalPrice: 2100 }, { materialName: "Turmeric Powder", quantity: 5, unit: "kg", unitPrice: 280, totalPrice: 1400 }, { materialName: "Vinegar", quantity: 10, unit: "liter", unitPrice: 100, totalPrice: 1000 }],
    [{ materialName: "Lapsi (Hog Plum)", quantity: 20, unit: "kg", unitPrice: 120, totalPrice: 2400 }, { materialName: "Jaggery", quantity: 10, unit: "kg", unitPrice: 150, totalPrice: 1500 }],
    [{ materialName: "Glass Jars (300ml)", quantity: 200, unit: "pcs", unitPrice: 35, totalPrice: 7000 }, { materialName: "Labels", quantity: 500, unit: "pcs", unitPrice: 8, totalPrice: 4000 }],
  ];

  for (let i = 0; i < purchaseItems.length; i++) {
    const items = purchaseItems[i];
    const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);
    const discount = Math.random() > 0.8 ? Math.round(subtotal * 0.05) : 0;
    const grandTotal = subtotal - discount;
    const supplier = suppliers[i % suppliers.length];
    const paymentStatuses = ["paid", "credit", "paid", "paid", "credit", "paid", "paid", "paid"];

    await createDoc("purchases", `purch-${String(1001 + i).padStart(4, "0")}`, {
      purchaseNumber: `PUR-2082-${String(1001 + i).padStart(4, "0")}`,
      supplierName: supplier.name,
      supplierPhone: supplier.phone,
      supplierAddress: supplier.address,
      items,
      subtotal,
      discount,
      grandTotal,
      paymentStatus: paymentStatuses[i],
      paymentHistory: paymentStatuses[i] !== "credit" ? [{ method: "bank", amount: grandTotal, receivedBy: "staff-manager", receivedByName: "Sita Sharma", receivedAt: ts(2025, 3, 1 + i * 7), note: "Bank transfer" }] : [],
      billImage: "",
      notes: "",
      createdBy: "staff-manager",
      createdAt: ts(2025, 3, 1 + i * 7),
      updatedAt: ts(2025, 3, 1 + i * 7),
    });
  }

  // ========== EXPENSES ==========
  console.log("\n--- Expenses ---");
  const expenseCategories = ["Rent", "Electricity", "Wages", "Marketing", "Packaging", "Transport"];
  const expenseData = [
    { category: "Rent", description: "Shop rent - March 2025", amount: 25000, date: ts(2025, 3, 5) },
    { category: "Electricity", description: "NEA bill - March 2025", amount: 4200, date: ts(2025, 3, 12) },
    { category: "Wages", description: "Cook salary - March 2025", amount: 18000, date: ts(2025, 3, 28) },
    { category: "Marketing", description: "Facebook ads campaign", amount: 5000, date: ts(2025, 3, 15) },
    { category: "Packaging", description: "Custom label printing", amount: 8500, date: ts(2025, 3, 8) },
    { category: "Transport", description: "Delivery rider fees", amount: 3200, date: ts(2025, 3, 20) },
    { category: "Rent", description: "Shop rent - April 2025", amount: 25000, date: ts(2025, 4, 5) },
    { category: "Electricity", description: "NEA bill - April 2025", amount: 3800, date: ts(2025, 4, 10) },
    { category: "Wages", description: "Cook salary - April 2025", amount: 18000, date: ts(2025, 4, 28) },
    { category: "Marketing", description: "Instagram promotion", amount: 3000, date: ts(2025, 4, 18) },
    { category: "Packaging", description: "Glass jar purchase", amount: 12000, date: ts(2025, 4, 2) },
    { category: "Transport", description: "Supplier pickup transport", amount: 1500, date: ts(2025, 4, 22) },
    { category: "Rent", description: "Shop rent - May 2025", amount: 25000, date: ts(2025, 5, 5) },
    { category: "Electricity", description: "NEA bill - May 2025", amount: 5100, date: ts(2025, 5, 11) },
    { category: "Wages", description: "Cook salary - May 2025", amount: 18000, date: ts(2025, 5, 28) },
    { category: "Wages", description: "Helper salary - May 2025", amount: 10000, date: ts(2025, 5, 28) },
    { category: "Marketing", description: "Festival brochure printing", amount: 7000, date: ts(2025, 5, 14) },
    { category: "Transport", description: "Delivery rider fees", amount: 4100, date: ts(2025, 5, 25) },
  ];

  for (let i = 0; i < expenseData.length; i++) {
    const exp = expenseData[i];
    await createDoc("expenses", `exp-${String(2001 + i).padStart(4, "0")}`, {
      ...exp,
      paidBy: "staff-manager",
      paidByName: "Sita Sharma",
      billImage: "",
      notes: "",
      createdAt: exp.date,
      updatedAt: exp.date,
    });
  }

  // ========== DEBTORS ==========
  console.log("\n--- Debtors ---");
  const debtorCustomers = [
    { name: "Hari Subedi", phone: "+977-9889012345", orders: [{ orderNumber: "ORD-2082-1005", amount: 1250, paidAmount: 500, balance: 750 }] },
    { name: "Deepa Gurung", phone: "+977-9845678901", orders: [{ orderNumber: "ORD-2082-1008", amount: 2300, paidAmount: 1000, balance: 1300 }] },
    { name: "Laxmi Neupane", phone: "+977-9822233445", orders: [{ orderNumber: "ORD-2082-1012", amount: 890, paidAmount: 0, balance: 890 }] },
  ];

  for (const d of debtorCustomers) {
    await createDoc("debtors", `debtor-${d.phone.replace(/[^0-9]/g, "")}`, {
      customerName: d.name,
      customerPhone: d.phone,
      totalOutstanding: d.orders.reduce((s, o) => s + o.balance, 0),
      orders: d.orders.map((o) => ({
        orderId: "",
        ...o,
        date: ts(2025, 4, 15),
      })),
      paymentHistory: [],
      clearedAt: null,
      createdAt: ts(2025, 4, 15),
      updatedAt: ts(2025, 4, 15),
    });
  }

  // ========== CREDITORS ==========
  console.log("\n--- Creditors ---");
  const creditorSuppliers = [
    { name: "Himalayan Spice Traders", phone: "+977-9811112222", purchases: [{ purchaseNumber: "PUR-2082-1001", amount: 10200, paidAmount: 5000, balance: 5200 }] },
    { name: "Kathmandu Meat Supply", phone: "+977-9822223333", purchases: [{ purchaseNumber: "PUR-2082-1005", amount: 8400, paidAmount: 4000, balance: 4400 }] },
  ];

  for (const c of creditorSuppliers) {
    const phoneClean = c.phone.replace(/[^0-9]/g, "");
    const existing = await fetch(`${FIRESTORE_URL}/creditors/creditor-${phoneClean}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!existing.ok) {
      await createDoc("creditors", `creditor-${phoneClean}`, {
        supplierName: c.name,
        supplierPhone: c.phone,
        totalOutstanding: c.purchases.reduce((s, p) => s + p.balance, 0),
        purchases: c.purchases.map((p) => ({
          purchaseId: "",
          ...p,
          date: ts(2025, 3, 15),
        })),
        paymentHistory: [],
        clearedAt: null,
        createdAt: ts(2025, 3, 15),
        updatedAt: ts(2025, 3, 15),
      });
    }
  }

  // ========== COUNTERS ==========
  console.log("\n--- Counters ---");
  const counters = [
    { id: "orderNumber", sequence: 1025, year: 2082, updatedAt: new Date() },
    { id: "batchNumber", sequence: 8, year: 2082, updatedAt: new Date() },
    { id: "purchaseNumber", sequence: 1008, year: 2082, updatedAt: new Date() },
  ];
  for (const c of counters) {
    await ensureDoc("counters", c.id, c);
  }

  // ========== ACTIVITY LOGS ==========
  console.log("\n--- Activity Logs ---");
  const activities = [
    { action: "Created product", details: "Created product 'Buff Achar' with 3 SKUs", module: "Products", performedBy: "staff-manager", performedByName: "Sita Sharma", undoable: false, undoData: null },
    { action: "Created product", details: "Created product 'Chicken Achar' with 2 SKUs", module: "Products", performedBy: "staff-manager", performedByName: "Sita Sharma", undoable: false, undoData: null },
    { action: "Created batch", details: "Created batch BAT-2082-001 for Buff Achar", module: "Batches", performedBy: "staff-manager", performedByName: "Sita Sharma", undoable: true, undoData: { batchNumber: "BAT-2082-001" } },
    { action: "Updated order status", details: "Order ORD-2082-1003 marked as shipped", module: "Orders", performedBy: "staff-staff", performedByName: "Ram Pandey", undoable: false, undoData: null },
    { action: "Created purchase", details: "Purchase PUR-2082-1001 from Himalayan Spice Traders", module: "Purchases", performedBy: "staff-manager", performedByName: "Sita Sharma", undoable: false, undoData: null },
    { action: "Logged in", details: "Staff login from admin panel", module: "System", performedBy: "staff-manager", performedByName: "Sita Sharma", undoable: false, undoData: null },
    { action: "Logged in", details: "Staff login from admin panel", module: "System", performedBy: "super-admin", performedByName: "Admin", undoable: false, undoData: null },
    { action: "Updated settings", details: "Updated store settings", module: "Settings", performedBy: "super-admin", performedByName: "Admin", undoable: false, undoData: null },
  ];

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const logDate = new Date(Date.now() - (activities.length - i) * 3600000);
    await createDoc("activityLog", `log-${String(3001 + i).padStart(4, "0")}`, {
      ...a,
      relatedDocId: null,
      timestamp: logDate,
    });
  }

  // ========== DASHBOARD CACHE ==========
  console.log("\n--- Dashboard Cache ---");
  await ensureDoc("dashboard", "cache", {
    todayOrders: 3,
    pendingOrders: 7,
    revenueThisMonth: 45800,
    lowStockItems: 4,
    activeProducts: 18,
    dueDebtors: 2940,
    dueCreditors: 9600,
    recentActivity: [
      { time: "2 hours ago", action: "Order ORD-2082-1025 marked as delivered", user: "Ram Pandey" },
      { time: "5 hours ago", action: "New order ORD-2082-1024 received", user: "Customer" },
      { time: "1 day ago", action: "Batch BAT-2082-008 completed", user: "Sita Sharma" },
      { time: "2 days ago", action: "Purchase PUR-2082-1008 processed", user: "Sita Sharma" },
    ],
    computedAt: new Date(),
  });

  // ========== PUBLIC CATALOG CACHE (store inside products doc for rule compatibility) ==========
  console.log("\n--- Public Catalog Cache ---");
  // Write to products/publicCatalogCache as a fallback location the rules allow
  const publicProducts = products.map((p) => {
    const minPrice = Math.min(...p.skus.map((s) => s.price));
    const maxPrice = Math.max(...p.skus.map((s) => s.price));
    const catNames = p.categoryIds.map((cid) => {
      const cat = catData.find((c) => c.id === cid);
      return cat ? cat.name : "";
    }).filter(Boolean);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      images: p.images || [],
      categoryIds: p.categoryIds,
      categoryNames: catNames,
      tags: p.tags,
      isFeatured: p.isFeatured,
      isActive: true,
      skus: p.skus.map((s) => ({
        id: `${p.id}-${s.skuCode}`,
        skuCode: s.skuCode,
        label: s.label,
        weightInGrams: s.weightInGrams,
        price: s.price,
        stock: 25 + Math.floor(Math.random() * 50),
        isActive: true,
        isAvailable: true,
      })),
      minPrice,
      maxPrice,
      isInStock: true,
    };
  });

  // Try publicCatalog/cache first, fall back to products/publicCatalogCache
  const catCache = {
    updatedAt: new Date(),
    version: 1,
    products: publicProducts,
  };
  const cacheResult = await createDoc("publicCatalog", "cache", catCache);
  if (!cacheResult) {
    console.log("  publicCatalog/cache not writable (rules restriction), using products/publicCatalogCache instead");
    await ensureDoc("products", "publicCatalogCache", {
      title: "Public Product Catalog",
      ...catCache,
    });
  }

  console.log("\n=== SEEDING COMPLETE ===");
}

seed().catch((e) => { console.error("Seed error:", e); process.exit(1); });
