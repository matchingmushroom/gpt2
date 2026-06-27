import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-forest-green via-olive-green to-forest-green-dark px-4 py-20 text-white sm:py-28">
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />

      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="mb-3 inline-block rounded-full bg-white/20 px-4 py-1 text-sm font-medium backdrop-blur-sm">
            Homemade. Authentic. Nepali.
          </p>
          <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Taste the
            <span className="text-mustard-gold"> real Nepal</span>
            ,<br />
            one jar at a time
          </h1>
          <p className="mt-4 max-w-lg text-lg text-white/80">
            Handcrafted pickles made with traditional family recipes, fresh
            ingredients, and zero preservatives. Delivered to your door.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              href="#products"
              className="rounded-btn bg-mustard-gold px-6 py-3 text-center font-semibold text-forest-green-dark transition-colors hover:bg-mustard-gold-light sm:text-left"
            >
              Shop Now
            </Link>
            <Link
              href="#about"
              className="rounded-btn border border-white/40 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-white/10 sm:text-left"
            >
              Our Story
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
