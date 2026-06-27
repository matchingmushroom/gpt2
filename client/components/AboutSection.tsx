export default function AboutSection() {
  return (
    <section id="about" className="bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="order-1 flex aspect-square items-center justify-center rounded-image bg-beige text-8xl lg:order-none">
            🫙
          </div>

          <div className="order-2 lg:order-none">
            <span className="text-xs font-medium uppercase tracking-wider text-mustard-gold sm:text-sm">
              Our Story
            </span>
            <h2 className="mt-2 font-heading text-2xl font-bold text-forest-green sm:text-3xl lg:text-4xl">
              Homemade Since Generations
            </h2>
            <p className="mt-4 leading-relaxed text-text-light">
              Great Pickle Taste was born from a simple belief — the best pickles
              are made at home, with love, patience, and the finest ingredients
              Nepal has to offer.
            </p>
            <p className="mt-3 leading-relaxed text-text-light">
              Every jar is crafted in small batches using traditional recipes
              passed down through generations. We source our mustard oil from
              local cold-presses, our chilies from the Terai farms, and our
              timur (Sichuan pepper) from the Himalayan foothills.
            </p>
            <p className="mt-3 leading-relaxed text-text-light">
              No preservatives. No artificial flavors. Just pure, authentic taste.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 text-center sm:grid-cols-3 sm:gap-4">
              <div className="rounded-card bg-beige/50 p-4">
                <div className="text-2xl font-bold text-forest-green">100%</div>
                <div className="text-xs text-text-muted">Natural</div>
              </div>
              <div className="rounded-card bg-beige/50 p-4">
                <div className="text-2xl font-bold text-forest-green">0</div>
                <div className="text-xs text-text-muted">Preservatives</div>
              </div>
              <div className="rounded-card bg-beige/50 p-4">
                <div className="text-2xl font-bold text-forest-green">15+</div>
                <div className="text-xs text-text-muted">Varieties</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
