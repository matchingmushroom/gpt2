const fs = require("fs");
const path = require("path");

async function main() {
  const outputPath = path.join(__dirname, "..", "data", "products.json");
  const defaultPath = path.join(__dirname, "..", "public", "data", "products.default.json");

  const tryRead = async (collection, docId) => {
    const admin = require("firebase-admin");
    const db = admin.firestore();
    const snap = await db.collection(collection).doc(docId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data.products || !data.products.length) return null;
    return data.products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.categoryNames?.[0] || p.categoryIds?.[0] || "",
      categoryIds: p.categoryIds || [],
      categoryNames: p.categoryNames || [],
      isFeatured: p.isFeatured || false,
      image: p.images?.[0] || "🥫",
      images: p.images || [],
      tags: p.tags || [],
      skus: (p.skus || []).map((s) => ({
        label: s.label,
        weightGrams: s.weightInGrams,
        price: s.price,
      })),
    }));
  };

  try {
    const admin = require("firebase-admin");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }

    let products = await tryRead("publicCatalog", "cache");
    if (!products) products = await tryRead("products", "publicCatalogCache");

    if (products) {
      fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
      console.log(`Written ${products.length} products to ${outputPath}`);
      return;
    }
  } catch (err) {
    console.warn(`Firestore unavailable (${err.message}). Using default data.`);
  }

  fs.copyFileSync(defaultPath, outputPath);
  const count = JSON.parse(fs.readFileSync(defaultPath, "utf8")).length;
  console.log(`Using default data: ${count} products written to ${outputPath}`);
}

main();
