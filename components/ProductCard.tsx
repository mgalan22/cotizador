import React from 'react';
import { Product } from '../types';
import { Package, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  product: Product;
  onSelect?: () => void;
}

export const ProductCard: React.FC<Props> = ({ product, onSelect }) => {
  const hasStock = product.stock > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow mb-2 text-left">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-gray-800 text-sm">{product.name}</h4>
          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-1 py-0.5 rounded">
            {product.code}
          </span>
        </div>
        <span className="font-bold text-brand-700">
          ${product.price.toFixed(2)}
        </span>
      </div>
      
      <p className="text-xs text-gray-600 mt-2 line-clamp-2">
        {product.description}
      </p>

      <div className="flex items-center justify-between mt-3">
        <span className={`text-xs flex items-center gap-1 ${hasStock ? 'text-nature-600' : 'text-red-500'}`}>
          {hasStock ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          {hasStock ? `${product.stock} un. disponibles` : 'Sin stock'}
        </span>
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full border">
            {product.brand}
        </span>
      </div>
    </div>
  );
};