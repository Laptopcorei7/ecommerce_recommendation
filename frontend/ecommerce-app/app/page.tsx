import Header from "./components/Header"
import Hero from "./components/Hero"
import FeaturedProducts from "./components/FeaturedProducts"
import Categories from "./components/Categories"
import RecommendedProducts from "./components/RecommendedProducts"
import Newsletter from "./components/Newsletter"
import Footer from "./components/Footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <FeaturedProducts />
        <Categories />
        <RecommendedProducts />
        <Newsletter />
      </main>
      <Footer />
    </div>
  )
}
