import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Hero() {
  return (
    <section className="relative bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Latest Electronics & Tech</h1>
            <p className="text-xl mb-8 text-purple-100">
              Discover cutting-edge technology, premium electronics, and innovative gadgets. From smartphones to smart homes, find your perfect tech companion.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-gray-100">
                <Link href="/products">Shop Electronics</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white hover:text-purple-600 bg-transparent"
              >
                <Link href="/deals">Tech Deals</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="bg-gray-200 rounded-lg aspect-square flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-2">🖼️</div>
                <p>Hero Image Placeholder</p>
                <p className="text-sm">1200x800 recommended</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
