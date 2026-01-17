import { GOOGLE_SHEET_CSV_URL } from '../constants';
import { Product, CartItem } from '../types';

let catalogCache: Product[] | null = null;

// Función simple para parsear líneas CSV respetando comillas
const parseCSVLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, '')); 
  return values;
};

// Heurística mejorada para detectar formato numérico (AR vs US)
const parsePrice = (priceStr: string): number => {
  if (!priceStr) return 0;
  
  // Limpieza: solo números, puntos, comas y menos
  const clean = priceStr.replace(/[^0-9.,-]/g, '');
  if (!clean) return 0;

  // Si tiene coma y punto (Ej: 1.000,00 o 1,000.00)
  if (clean.includes(',') && clean.includes('.')) {
    const lastDotIndex = clean.lastIndexOf('.');
    const lastCommaIndex = clean.lastIndexOf(',');
    
    // Si la coma está después del punto -> Formato AR/EU (1.000,00)
    if (lastCommaIndex > lastDotIndex) {
       return parseFloat(clean.replace(/\./g, '').replace(',', '.'));
    } 
    // Si el punto está después de la coma -> Formato US (1,000.00)
    else {
       return parseFloat(clean.replace(/,/g, ''));
    }
  }

  // Si solo tiene punto (Ej: 32.363 o 32.36)
  if (clean.includes('.') && !clean.includes(',')) {
     const parts = clean.split('.');
     const lastPart = parts[parts.length - 1];
     
     if (lastPart.length === 3) {
         return parseFloat(clean.replace(/\./g, ''));
     }
     return parseFloat(clean);
  }

  // Si solo tiene coma (Ej: 32,363 o 32,50)
  if (clean.includes(',') && !clean.includes('.')) {
    const parts = clean.split(',');
    const lastPart = parts[parts.length - 1];
    
    if (lastPart.length === 3) {
        return parseFloat(clean.replace(/,/g, ''));
    }
    return parseFloat(clean.replace(',', '.'));
  }

  // Solo números
  return parseFloat(clean);
};

/**
 * Obtiene y parsea el catálogo desde Google Sheets
 */
const fetchCatalog = async (): Promise<Product[]> => {
  if (catalogCache) return catalogCache;

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const text = await response.text();
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    // Asumimos que la primera fila es encabezado
    const products: Product[] = lines.slice(1).map((line): Product | null => {
      const cols = parseCSVLine(line);
      
      const enabled = cols[19]?.toUpperCase() || 'NO';
      if (enabled !== 'SI') return null; // Filtrar productos deshabilitados

      const priceStr = cols[16] || '0';
      const stockStr = cols[25] || '0';
      
      const price = parsePrice(priceStr);
      const stock = parseInt(stockStr.replace(/[^0-9-]/g, '')) || 0;

      // Truncar descripción para ahorrar tokens
      let description = cols[17] || '';
      if (description.length > 200) {
        description = description.substring(0, 197) + '...';
      }

      return {
        code: cols[0] || 'S/C',
        name: cols[1] || 'Sin Nombre',
        publicName: cols[2] || '',
        brand: cols[7] || 'Genérico',
        category: cols[3] || 'General',
        subCategory: cols[4] || '',
        description: description,
        imageUrl: cols[18] || '',
        keywords: cols[22] || '',
        price: isNaN(price) ? 0 : price,
        stock: stock
      };
    }).filter((p): p is Product => p !== null && p.price > 0); 

    catalogCache = products;
    return catalogCache;
  } catch (error) {
    console.error("Error fetching catalog from Google Sheets:", error);
    return [];
  }
};

/**
 * Busca productos en el catálogo de Google Sheets
 * Soporta filtrado por Categoría + Palabras Clave + CÓDIGO EXACTO
 */
export const searchProductsInCatalog = async (query: string, category?: string): Promise<Product[]> => {
  const catalog = await fetchCatalog();
  const cleanQuery = query.toLowerCase().trim();
  const cleanCategory = category?.toLowerCase().trim();
  
  if (!cleanQuery && !cleanCategory) return [];

  // 1. Filtrado inicial por Categoría (Rubro - Columna D)
  let candidates = catalog;
  if (cleanCategory) {
    candidates = candidates.filter(p => 
      p.category.toLowerCase().includes(cleanCategory) || 
      p.subCategory?.toLowerCase().includes(cleanCategory)
    );
  }

  // 1.5 Optimización: Búsqueda exacta por código
  const exactCodeMatch = candidates.find(p => p.code.toLowerCase() === cleanQuery);
  if (exactCodeMatch) return [exactCodeMatch];

  // 2. Filtrado por Tokens (Palabras Clave) sobre los candidatos
  // Lista de palabras vacías (stop words) en español para ignorar
  const stopWords = ['de', 'con', 'para', 'el', 'la', 'los', 'las', 'un', 'una', 'y', 'x', 'en'];
  
  const tokens = cleanQuery.split(/\s+/)
    .filter(t => t.length > 0 && !stopWords.includes(t) && t.length > 1); // Ignorar tokens muy cortos excepto si son números/medidas que se manejan aparte

  if (tokens.length === 0) {
    // Si se filtraron todos los tokens (ej: "de la"), devolvemos vacío si no había categoría
    return cleanCategory ? candidates.slice(0, 10) : [];
  }

  const matchesTokens = (text: string | undefined, tokenList: string[]): boolean => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return tokenList.every(token => lowerText.includes(token));
  };

  // ESTRATEGIA A: Match Estricto (Todas las palabras relevantes deben aparecer)
  // Prioridad A1: CÓDIGO o Nombre DUX
  const matchCodeOrName = candidates.filter(p => matchesTokens(p.code, tokens) || matchesTokens(p.name, tokens));
  // Prioridad A2: Nombre Web
  const matchPublic = candidates.filter(p => matchesTokens(p.publicName, tokens) && !matchCodeOrName.includes(p));
  // Prioridad A3: Keywords
  const matchKeywords = candidates.filter(p => matchesTokens(p.keywords, tokens) && !matchCodeOrName.includes(p) && !matchPublic.includes(p));

  let results = [...matchCodeOrName, ...matchPublic, ...matchKeywords];

  // ESTRATEGIA B: Match Parcial (Fallback)
  // Si no hay resultados estrictos, buscamos productos que tengan al menos ALGUNOS de los tokens
  if (results.length === 0 && tokens.length > 1) {
    const scoredCandidates = candidates.map(p => {
        let score = 0;
        const text = `${p.name} ${p.publicName} ${p.keywords} ${p.category}`.toLowerCase();
        tokens.forEach(t => {
            if (text.includes(t)) score++;
        });
        return { product: p, score };
    });

    // Filtramos los que tengan al menos 1 coincidencia y ordenamos por score
    results = scoredCandidates
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product)
        .slice(0, 5); // Limitamos fallback a 5 para no llenar de basura
  }

  return results.slice(0, 15);
};

/**
 * Simula creación de pedido en Dux Software
 */
export const createOrderInDux = async (items: CartItem[]): Promise<{ orderId: string; status: string }> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  if (items.length === 0) {
    throw new Error("El carrito está vacío.");
  }

  const mockOrderId = `DUX-${Math.floor(Math.random() * 10000) + 1000}`;
  
  return {
    orderId: mockOrderId,
    status: 'created'
  };
};