import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AboutSection from "@/components/AboutSection";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-forest-green px-4 py-16 text-center text-white">
          <h1 className="font-heading text-4xl font-bold">About Great Pickle Taste</h1>
          <p className="mt-3 text-white/70">Bringing authentic Nepali flavors to your table</p>
        </section>
        <AboutSection />
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="font-heading text-2xl font-bold text-text">Our Story</h2>
          <div className="mt-4 space-y-4 text-text-light leading-relaxed">
            <p>
              Great Pickle Taste was born in a small kitchen in Pokhara, Nepal, with a simple belief:
              the best pickles are made the way your grandmother made them — with patience, love, and
              the finest natural ingredients.
            </p>
            <p>
              Every jar begins with fresh, locally sourced produce. We sun-dry our vegetables under
              the Himalayan sun, roast our spices in small batches, and use cold-pressed mustard oil
              for that authentic punch of flavor. No preservatives. No artificial colors. Just pure,
              honest taste.
            </p>
            <p>
              From our family to yours — thank you for being part of our journey.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Years", value: "5+" },
              { label: "Varieties", value: "15+" },
              { label: "Happy Customers", value: "2,000+" },
              { label: "Natural Ingredients", value: "100%" },
            ].map((s) => (
              <div key={s.label} className="rounded-card bg-beige p-4 text-center">
                <p className="font-heading text-2xl font-bold text-forest-green">{s.value}</p>
                <p className="mt-1 text-xs text-text-light">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
