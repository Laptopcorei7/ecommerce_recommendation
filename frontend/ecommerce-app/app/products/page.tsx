"use client"

import { useState } from "react"
import Header from "../components/Header"
import Footer from "../components/Footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Star, Heart, Filter, Grid, List } from 'lucide-react'

const products = [
  {
    id: 1,
    name: "iPhone 15 Pro Max 256GB",
    price: 1199.99,
    originalPrice: 1299.99,
    rating: 4.8,
    reviews: 342,
    category: "Smartphones",
    brand: "Apple",
  },
  {
    id: 2,
    name: "MacBook Air M3 13-inch",
    price: 1099.99,
    originalPrice: 1199.99,
    rating: 4.9,
    reviews: 256,
    category: "Laptops",
    brand: "Apple",
  },
  {
    id: 3,
    name: "Sony WH-1000XM5 Headphones",
    price: 349.99,
    originalPrice: 399.99,
    rating: 4.7,
    reviews: 189,
    category: "Audio",
    brand: "Sony",
  },
  {
    id: 4,
    name: "Samsung Galaxy S24 Ultra",
    price: 1199.99,
    rating: 4.6,
    reviews: 423,
    category: "Smartphones",
    brand: "Samsung",
  },
  {
    id: 5,
    name: "PlayStation 5 Console",
    price: 499.99,
    rating: 4.8,
    reviews: 678,
    category: "Gaming",
    brand: "Sony",
  },
  {
    id: 6,
    name: "iPad Pro 12.9-inch M2",
    price: 1099.99,
    originalPrice: 1199.99,
    rating: 4.8,
    reviews: 234,
    category: "Tablets",
    brand: "Apple",
  },
]

const categories = ["All", "Smartphones", "Laptops", "Audio", "Gaming", "Tablets", "Smart Home"]
const brands = ["All", "Apple", "Samsung", "Sony", "Dell", "HP", "Google", "Nintendo"]
const priceRanges = [
  { label: "All Prices", min: 0, max: Number.POSITIVE_INFINITY },
  { label: "Under $25", min: 0, max: 25 },
  { label: "$25 - $50", min: 25, max: 50 },
  { label: "$50 - $100", min: 50, max: 100 },
  { label: "Over $100", min: 100, max: Number.POSITIVE_INFINITY },
]

export default function ProductsPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState("featured")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [selectedBrand, setSelectedBrand] = useState("All")
  const [selectedPriceRange, setSelectedPriceRange] = useState(priceRanges[0])
  const [showFilters, setShowFilters] = useState(false)

  const filteredProducts = products.filter((product) => {
    const categoryMatch = selectedCategory === "All" || product.category === selectedCategory
    const brandMatch = selectedBrand === "All" || product.brand === selectedBrand
    const priceMatch = product.price >= selectedPriceRange.min && product.price <= selectedPriceRange.max
    return categoryMatch && brandMatch && priceMatch
  })

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "price-low":
        return a.price - b.price
      case "price-high":
        return b.price - a.price
      case "rating":
        return b.rating - a.rating
      case "name":
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Electronics & Technology</h1>
          <p className="text-gray-600">Discover our complete collection of cutting-edge electronics and tech gadgets</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:w-64 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="bg-white border rounded-lg p-6 sticky top-4">
              <h3 className="text-lg font-semibold mb-4">Filters</h3>

              {/* Category Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Category</h4>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center">
                      <Checkbox
                        id={category}
                        checked={selectedCategory === category}
                        onCheckedChange={() => setSelectedCategory(category)}
                      />
                      <label htmlFor={category} className="ml-2 text-sm cursor-pointer">
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Brand</h4>
                <div className="space-y-2">
                  {brands.map((brand) => (
                    <div key={brand} className="flex items-center">
                      <Checkbox
                        id={brand}
                        checked={selectedBrand === brand}
                        onCheckedChange={() => setSelectedBrand(brand)}
                      />
                      <label htmlFor={brand} className="ml-2 text-sm cursor-pointer">
                        {brand}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Price Range</h4>
                <div className="space-y-2">
                  {priceRanges.map((range) => (
                    <div key={range.label} className="flex items-center">
                      <Checkbox
                        id={range.label}
                        checked={selectedPriceRange.label === range.label}
                        onCheckedChange={() => setSelectedPriceRange(range)}
                      />
                      <label htmlFor={range.label} className="ml-2 text-sm cursor-pointer">
                        {range.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setSelectedCategory("All")
                  setSelectedBrand("All")
                  setSelectedPriceRange(priceRanges[0])
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Products Section */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden bg-transparent"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                </Button>
                <p className="text-gray-600">
                  Showing {sortedProducts.length} of {products.length} products
                </p>
              </div>

              <div className="flex items-center gap-4">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                    <SelectItem value="rating">Highest Rated</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex border rounded">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Products Grid/List */}
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
              {sortedProducts.map((product) => (
                <Card key={product.id} className="group hover:shadow-lg transition-shadow">
                  <CardContent className={viewMode === "grid" ? "p-0" : "p-4"}>
                    <div className={viewMode === "grid" ? "" : "flex gap-4"}>
                      <div className={`relative ${viewMode === "list" ? "w-32 h-32 flex-shrink-0" : ""}`}>
                        <div
                          className={`bg-gray-200 flex items-center justify-center rounded-t-lg ${
                            viewMode === "list" ? "w-32 h-32 rounded" : "aspect-square"
                          }`}
                        >
                          <div className="text-center text-gray-500">
                            <div className="text-2xl mb-1">📦</div>
                            <p className="text-xs">Product</p>
                            <p className="text-xs">400x400</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                        >
                          <Heart className="h-4 w-4" />
                        </Button>
                        {product.originalPrice && product.originalPrice > product.price && (
                          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold">
                            SALE
                          </div>
                        )}
                      </div>

                      <div className={viewMode === "grid" ? "p-4" : "flex-1"}>
                        <p className="text-sm text-gray-500 mb-1">{product.category}</p>
                        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                        <p className="text-sm text-gray-600 mb-2">{product.brand}</p>
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
                            {product.originalPrice && product.originalPrice > product.price && (
                              <span className="text-sm text-gray-500 line-through ml-2">${product.originalPrice}</span>
                            )}
                          </div>
                        </div>
                        <Button className="w-full mt-3" size="sm">
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center mt-12">
              <div className="flex space-x-2">
                <Button variant="outline" disabled>
                  Previous
                </Button>
                <Button variant="default">1</Button>
                <Button variant="outline">2</Button>
                <Button variant="outline">3</Button>
                <Button variant="outline">Next</Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
