"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Star, Heart, ChevronLeft, ChevronRight } from 'lucide-react'

const recommendedProducts = [
  {
    id: 1,
    name: "iPad Pro 12.9-inch M2",
    price: 1099.99,
    originalPrice: 1199.99,
    rating: 4.8,
    reviews: 234,
    category: "Tablets",
    reason: "Based on your recent views",
  },
  {
    id: 2,
    name: "AirPods Pro 2nd Gen",
    price: 249.99,
    rating: 4.7,
    reviews: 456,
    category: "Audio",
    reason: "Customers also bought",
  },
  {
    id: 3,
    name: "Samsung Galaxy Watch 6",
    price: 329.99,
    originalPrice: 399.99,
    rating: 4.5,
    reviews: 189,
    category: "Wearables",
    reason: "Trending now",
  },
  {
    id: 4,
    name: "Nintendo Switch OLED",
    price: 349.99,
    rating: 4.9,
    reviews: 567,
    category: "Gaming",
    reason: "Perfect match for you",
  },
  {
    id: 5,
    name: "Dell XPS 13 Laptop",
    price: 999.99,
    originalPrice: 1199.99,
    rating: 4.6,
    reviews: 178,
    category: "Laptops",
    reason: "Similar to your purchases",
  },
  {
    id: 6,
    name: "Google Nest Hub Max",
    price: 229.99,
    rating: 4.4,
    reviews: 92,
    category: "Smart Home",
    reason: "Recommended for you",
  },
]

export default function RecommendedProducts() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const productsPerView = 4

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + productsPerView >= recommendedProducts.length ? 0 : prev + productsPerView))
  }

  const prevSlide = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? Math.max(0, recommendedProducts.length - productsPerView) : prev - productsPerView,
    )
  }

  const visibleProducts = recommendedProducts.slice(currentIndex, currentIndex + productsPerView)

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Recommended for You</h2>
            <p className="text-gray-600">Personalized product suggestions based on your preferences</p>
          </div>
          <div className="hidden md:flex space-x-2">
            <Button variant="outline" size="icon" onClick={prevSlide} disabled={currentIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextSlide}
              disabled={currentIndex + productsPerView >= recommendedProducts.length}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleProducts.map((product) => (
            <Card key={product.id} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                <div className="relative">
                  <div className="bg-gray-200 aspect-square flex items-center justify-center rounded-t-lg">
                    <div className="text-center text-gray-500">
                      <div className="text-2xl mb-1">🎯</div>
                      <p className="text-xs">Recommended</p>
                      <p className="text-xs">400x400</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="absolute top-2 right-2 bg-white/80 hover:bg-white">
                    <Heart className="h-4 w-4" />
                  </Button>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                      DEAL
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                    {product.reason}
                  </div>
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
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-lg font-bold text-gray-900">${product.price}</span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-sm text-gray-500 line-through ml-2">${product.originalPrice}</span>
                      )}
                    </div>
                  </div>
                  <Button className="w-full" size="sm">
                    Add to Cart
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile navigation */}
        <div className="flex md:hidden justify-center mt-6 space-x-2">
          <Button variant="outline" size="sm" onClick={prevSlide} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={nextSlide}
            disabled={currentIndex + productsPerView >= recommendedProducts.length}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  )
}
