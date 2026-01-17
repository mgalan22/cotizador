import React from 'react';
import { CartItem, Quote } from '../types';
import { ShoppingCart, Trash2, Send, FileText, Plus, Minus } from 'lucide-react';

interface Props {
  quote: Quote;
  onRemoveItem: (code: string) => void;
  onUpdateQuantity: (code: string, newQuantity: number) => void;
  onClear: () => void;
  isProcessing: boolean;
}

export const QuoteSummary: React.FC<Props> = ({ quote, onRemoveItem, onUpdateQuantity, onClear, isProcessing }) => {
  if (quote.items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center border-l border-gray-100 bg-gray-50">
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <ShoppingCart size={32} className="text-gray-300" />
        </div>
        <p className="font-medium">Cotización vacía</p>
        <p className="text-sm mt-1">Los productos sugeridos aparecerán aquí.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl shadow-gray-200/50">
      <div className="p-5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText size={20} className="text-brand-600" />
            Resumen Cotización
          </h2>
          <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
            {quote.status === 'confirmed' ? 'Confirmado' : 'Borrador'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {quote.items.map((item) => (
          <div key={item.code} className="group relative bg-white border border-gray-100 rounded-lg p-3 hover:border-brand-200 transition-colors shadow-sm">
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-medium text-sm text-gray-800 pr-6">{item.name}</h4>
              <button 
                onClick={() => onRemoveItem(item.code)}
                className="text-gray-400 hover:text-red-500 absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
            
            <div className="flex justify-between items-end mt-2">
              {/* Controles de Cantidad */}
              <div className="flex items-center border border-gray-200 rounded-md bg-gray-50">
                <button 
                    onClick={() => onUpdateQuantity(item.code, item.quantity - 1)}
                    className="p-1 hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-50"
                    disabled={item.quantity <= 1}
                >
                    <Minus size={12} />
                </button>
                <input 
                    type="number" 
                    value={item.quantity}
                    onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        onUpdateQuantity(item.code, Math.max(1, val));
                    }}
                    className="w-10 text-center text-sm bg-transparent border-0 p-0 focus:ring-0 appearance-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button 
                    onClick={() => onUpdateQuantity(item.code, item.quantity + 1)}
                    className="p-1 hover:bg-gray-200 text-gray-600 transition-colors"
                >
                    <Plus size={12} />
                </button>
              </div>

              <div className="text-right">
                <div className="text-xs text-gray-500">Unit: ${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="font-semibold text-gray-900">
                  ${(item.quantity * item.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-400 flex items-center gap-1">
                <span className="bg-gray-100 px-1 rounded">{item.brand}</span>
                <span>{item.code}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 border-t border-gray-100 bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 font-medium">Total Estimado</span>
          <span className="text-2xl font-bold text-brand-700">
            ${quote.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        
        {quote.status === 'confirmed' ? (
             <div className="bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-center text-sm font-medium">
                Pedido generado en Dux
             </div>
        ) : (
            <p className="text-xs text-center text-gray-500">
                Pide al agente que confirme el pedido para generar el presupuesto
            </p>
        )}
      </div>
    </div>
  );
};