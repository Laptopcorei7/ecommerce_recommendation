"use client"

import { useState } from "react"
import Link from "next/link"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import RecommendedProducts from "../../components/RecommendedProducts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Heart, Share2, ShoppingCart, Truck, Shield, RotateCcw, ArrowLeft, Plus, Minus } from 'lucide-react'

// Mock product data
const product = {
  id: 1,
  name: "iPhone 15 Pro Max 256GB",
  price: 1199.99,
  originalPrice: 1299.99,
  rating: 4.8,
  reviews: 342,
  category: "Smartphones",
  brand: "Apple",
  inStock: true,
  stockCount: 15,
  description:
    "Experience the pinnacle of smartphone technology with the iPhone 15 Pro Max. Featuring the powerful A17 Pro chip, advanced camera system with 5x telephoto zoom, and stunning titanium design. Perfect for professionals and tech enthusiasts who demand the best.",
  features: [
    "A17 Pro chip with 6-core GPU",
    "Pro camera system with 5x telephoto",
    "Titanium design with Ceramic Shield",
    "6.7-inch Super Retina XDR display",
    "Up to 29 hours video playback",
    "USB-C with USB 3 support",
  ],
  specifications: {
    "Display Size": "6.7 inches",
    "Storage": "256GB",
    "Camera": "48MP Main, 12MP Ultra Wide, 12MP Telephoto",
    "Processor": "A17 Pro chip",
    "Battery": "Up to 29 hours video",
    "Connectivity": "5G, Wi-Fi 6E, Bluetooth 5.3",
  },
}

const reviews = [
  {
    id: 1,
    name: "Sarah Johnson",
    rating: 5,
    date: "2024-01-15",
    comment:
      "Amazing sound quality! The noise cancellation works perfectly and the battery lasts all day. Highly recommended!",
    verified: true,
  },
  {
    id: 2,
    name: "Mike Chen",
    rating: 4,
    date: "2024-01-10",
    comment:
      "Great headphones for the price. Comfortable to wear for long periods. Only minor issue is the case could be more compact.",
    verified: true,
  },
  {
    id: 3,
    name: "Emily Davis",
    rating: 5,
    date: "2024-01-05",
    comment:
      "Perfect for work calls and music. The microphone quality is excellent and colleagues can hear me clearly.",
    verified: true,
  },
]

export default function ProductPage() {
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)

  const images = ["Main product image - 800x600", "Side view - 800x600", "Detail view - 800x600", "In use - 800x600"]

  const handleAddToCart = () => {
    alert(`Added ${quantity} item(s) to cart!`)
  }

  const handleBuyNow = () => {
    alert("Redirecting to checkout...")
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-gray-700">
              Products
            </Link>
            <span>/</span>
            <Link href={`/categories/${product.category.toLowerCase()}`} className="hover:text-gray-700">
              {product.category}
            </Link>
            <span>/</span>
            <span className="text-gray-900">{product.name}</span>
          </div>
        </nav>

        <Button variant="ghost" asChild className="mb-6">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Link>
        </Button>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Product Images */}
          <div>
            <div className="mb-4">
              <div className="bg-gray-200 aspect-square rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">📷</div>
                  <p className="font-medium">{images[selectedImage]}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`bg-gray-200 aspect-square rounded-lg flex items-center justify-center text-xs text-gray-500 hover:bg-gray-300 transition-colors ${
                    selectedImage === index ? "ring-2 ring-blue-500" : ""
                  }`}
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">🖼️</div>
                    <p>View {index + 1}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div>
            <div className="mb-4">
              <Badge variant="secondary" className="mb-2">
                {product.category}
              </Badge>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <p className="text-gray-600 mb-4">by {product.brand}</p>

              <div className="flex items-center mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating) ? "text-yellow-400 fill-current" : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="ml-2 text-gray-600">
                  {product.rating} ({product.reviews} reviews)
                </span>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl font-bold text-gray-900">${product.price}</span>
                {product.originalPrice > product.price && (
                  <>
                    <span className="text-xl text-gray-500 line-through">${product.originalPrice}</span>
                    <Badge variant="destructive">Save ${(product.originalPrice - product.price).toFixed(2)}</Badge>
                  </>
                )}
              </div>

              {product.inStock ? (
                <div className="flex items-center text-green-600 mb-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                  <span>In Stock ({product.stockCount} available)</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600 mb-2">
                  <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                  <span>Out of Stock</span>
                </div>
              )}
            </div>

            <div className="mb-6">
              <p className="text-gray-700 leading-relaxed">{product.description}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold mb-3">Key Features:</h3>
              <ul className="space-y-2">
                {product.features.map((feature, index) => (
                  <li key={index} className="flex items-center text-gray-700">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3"></div>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Quantity and Actions */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-4">
                <span className="font-medium">Quantity:</span>
                <div className="flex items-center border rounded">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-10 w-10"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="px-4 py-2 min-w-[3rem] text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setQuantity(Math.min(product.stockCount, quantity + 1))}
                    className="h-10 w-10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button onClick={handleAddToCart} disabled={!product.inStock} className="flex-1" size="lg">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
                <Button onClick={handleBuyNow} disabled={!product.inStock} variant="outline" size="lg">
                  Buy Now
                </Button>
              </div>

              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => setIsWishlisted(!isWishlisted)} className="flex-1">
                  <Heart className={`h-4 w-4 mr-2 ${isWishlisted ? "fill-current text-red-500" : ""}`} />
                  {isWishlisted ? "Wishlisted" : "Add to Wishlist"}
                </Button>
                <Button variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>

            {/* Shipping & Returns */}
            <div className="border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center">
                  <Truck className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <p className="font-medium">Free Shipping</p>
                    <p className="text-gray-500">On orders over $50</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <RotateCcw className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <p className="font-medium">30-Day Returns</p>
                    <p className="text-gray-500">Easy returns policy</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 text-purple-600 mr-2" />
                  <div>
                    <p className="font-medium">2-Year Warranty</p>
                    <p className="text-gray-500">Manufacturer warranty</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mb-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="reviews">Reviews ({product.reviews})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Product Description</h3>
                  <div className="prose max-w-none">
                    <p className="mb-4">{product.description}</p>
                    <p className="mb-4">
                      These premium wireless headphones are designed for audiophiles and professionals who demand the
                      best in sound quality and comfort. With advanced active noise cancellation technology, you can
                      immerse yourself in your music without distractions from the outside world.
                    </p>
                    <p className="mb-4">
                      The 30-hour battery life ensures you can enjoy your music all day long, while the quick charge
                      feature gives you 3 hours of playback with just 15 minutes of charging. The premium leather ear
                      cushions provide exceptional comfort for extended listening sessions.
                    </p>
                    <p>
                      Whether you're working from home, traveling, or just relaxing, these headphones deliver an
                      exceptional audio experience that will exceed your expectations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-4">Technical Specifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(product.specifications).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-2 border-b">
                        <span className="font-medium text-gray-700">{key}:</span>
                        <span className="text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold">Customer Reviews</h3>
                    <Button variant="outline">Write a Review</Button>
                  </div>

                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b pb-6 last:border-b-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{review.name}</span>
                            {review.verified && (
                              <Badge variant="secondary" className="text-xs">
                                Verified Purchase
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">{review.date}</span>
                        </div>

                        <div className="flex items-center mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? "text-yellow-400 fill-current" : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>

                        <p className="text-gray-700">{review.comment}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Recommended Products */}
        <RecommendedProducts />
      </main>

      <Footer />
    </div>
  )
}
