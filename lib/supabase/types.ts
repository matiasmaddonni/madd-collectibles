export type ProductCondition = 'mint_sealed' | 'mint_open' | 'near_mint' | 'good' | 'fair'
export type ProductStatus = 'available' | 'reserved' | 'sold'

export interface Brand {
  id: string
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  sort_order: number
  created_at: string
}

export interface ProductLine {
  id: string
  brand_id: string
  slug: string
  name: string
  description: string | null
  banner_url: string | null
  sort_order: number
  created_at: string
}

export interface Series {
  id: string
  product_line_id: string
  slug: string
  name: string
  sort_order: number
}

export interface Product {
  id: string
  product_line_id: string
  series_id: string | null
  sku: string | null
  name: string
  slug: string
  description: string | null
  price: number
  cost_price: number | null
  condition: ProductCondition
  status: ProductStatus
  stock_qty: number
  is_featured: boolean
  release_year: number | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt: string | null
  is_primary: boolean
  sort_order: number
}

export interface PublicProduct extends Omit<Product, 'cost_price'> {}

export interface Database {
  public: {
    Tables: {
      brands: {
        Row: Brand
        Insert: Omit<Brand, 'id' | 'created_at'>
        Update: Partial<Omit<Brand, 'id' | 'created_at'>>
      }
      product_lines: {
        Row: ProductLine
        Insert: Omit<ProductLine, 'id' | 'created_at'>
        Update: Partial<Omit<ProductLine, 'id' | 'created_at'>>
      }
      series: {
        Row: Series
        Insert: Omit<Series, 'id'>
        Update: Partial<Omit<Series, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>
      }
      product_images: {
        Row: ProductImage
        Insert: Omit<ProductImage, 'id'>
        Update: Partial<Omit<ProductImage, 'id'>>
      }
    }
    Views: {
      public_products: {
        Row: PublicProduct
      }
    }
  }
}
