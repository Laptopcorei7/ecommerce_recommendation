import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Star, Heart } from 'lucide-react'

const featuredProducts = [
  {
    id: 1,
    name: "iPhone 15 Pro Max 256GB",
    price: 1199.99,
    originalPrice: 1299.99,
    rating: 4.8,
    reviews: 342,
    category: "Smartphones",
  },
  {
    id: 2,
    name: "MacBook Air M3 13-inch",
    price: 1099.99,
    originalPrice: 1199.99,
    rating: 4.9,
    reviews: 256,
    category: "Laptops",
  },
  {
    id: 3,
    name: "Sony WH-1000XM5 Headphones",
    price: 349.99,
    originalPrice: 399.99,
    rating: 4.7,
    reviews: 189,
    category: "Audio",
  },
  {
    id: 4,
    name: "Samsung 65\" QLED 4K TV",
    price: 899.99,
    originalPrice: 1199.99,
    rating: 4.6,
    reviews: 167,
    category: "TVs",
  },
]

export default function FeaturedProducts() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Featured Electronics</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Discover our handpicked selection of the latest and most popular electronic devices
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {featuredProducts.map((product) => (
            <Card key={product.id} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="relative">
                  <div className="bg-gray-200 aspect-square flex items-center justify-center rounded-t-lg">
                    <div className="text-center text-gray-500">
                      <div className="text-2xl mb-1">📦</div>
                      <p className="text-xs">Product Image</p>
                      <p className="text-xs">400x400</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-white/80 hover:bg-white">
                    <Heart className="h-4 w-4" />
                  </Button>
                  {product.originalPrice > product.price && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                      SALE
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-500 mb-1">{product.category}</p>
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                  <div className="flex items-center mb-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-500 ml-2">({product.reviews})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-gray-900">${product.price}</span>
                      {product.originalPrice > product.price && (
                        <span className="text-sm text-gray-500 line-through ml-2">${product.originalPrice}</span>
                      )}
                    </div>
                  </div>
                  <Button className="w-full mt-3" size="sm">
                    Add to Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" size="lg">
            <Link href="/products">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
