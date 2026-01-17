export interface Product {
  code: string;
  name: string; // Nombre DUX (Columna B)
  publicName?: string; // Nombre Web (Columna C)
  brand: string;
  description: string;
  price: number;
  stock: number;
  category: string; // Rubro (Columna D)
  subCategory?: string; // Sub Rubro (Columna E)
  keywords?: string;
  imageUrl?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Quote {
  items: CartItem[];
  total: number;
  status: 'draft' | 'confirmed' | 'submitted';
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
  relatedProducts?: Product[];
}

export enum ToolName {
  SEARCH_PRODUCTS = 'searchProducts',
  CREATE_ORDER = 'createOrder',
}