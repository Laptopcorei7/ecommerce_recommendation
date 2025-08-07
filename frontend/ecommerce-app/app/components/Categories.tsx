import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

const categories = [
  {
    id: 1,
    name: "Smartphones",
    description: "Latest mobile devices and accessories",
    productCount: 450,
    href: "/categories/smartphones",
  },
  {
    id: 2,
    name: "Laptops & Computers",
    description: "Powerful computing solutions",
    productCount: 320,
    href: "/categories/laptops",
  },
  {
    id: 3,
    name: "Audio & Headphones",
    description: "Premium sound experiences",
    productCount: 280,
    href: "/categories/audio",
  },
  {
    id: 4,
    name: "Gaming",
    description: "Consoles, accessories, and gear",
    productCount: 190,
    href: "/categories/gaming",
  },
  {
    id: 5,
    name: "Smart Home",
    description: "Connected home automation",
    productCount: 150,
    href: "/categories/smart-home",
  },
  {
    id: 6,
    name: "TVs & Displays",
    description: "Entertainment and monitors",
    productCount: 120,
    href: "/categories/tvs",
  },
]

export default function Categories() {
  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Shop Electronics Categories</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Explore our wide range of categories to find exactly what you're looking for
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Link key={category.id} href={category.href}>
              <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="p-0">
                  <div className="bg-gray-200 aspect-video flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <div className="text-3xl mb-2">🏷️</div>
                      <p className="text-sm">Category Image</p>
                      <p className="text-xs">600x400</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-gray-600 mb-3">{category.description}</p>
                    <p className="text-sm text-gray-500">{category.productCount.toLocaleString()} products</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
