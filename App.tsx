import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, X, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import { QuoteSummary } from './components/QuoteSummary';
import { AdminDashboard } from './components/AdminDashboard';
import { GeminiService } from './services/geminiService';
import { searchProductsInCatalog, createOrderInDux } from './services/dataService';
import { Message, Quote, CartItem } from './types';

// Helper para formatear texto con negritas estilo Markdown (**texto**)
const formatMessageContent = (text: string) => {
  if (!text) return null;
  return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-gray-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
};

function App() {
  const [isAdminMode, setIsAdminMode] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'admin') {
      setIsAdminMode(true);
    }
  }, []);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Hola, soy tu asistente experto en riego. ¿Qué necesitas cotizar hoy? Puedo ayudarte a encontrar rotores, válvulas, programadores y más.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [quote, setQuote] = useState<Quote>({
    items: [],
    total: 0,
    status: 'draft'
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const geminiRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    if (!isAdminMode) {
        geminiRef.current = new GeminiService();
    }
  }, [isAdminMode]);

  useEffect(() => {
    if (!isAdminMode) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAdminMode]);

  const updateQuoteTotal = (items: CartItem[]) => {
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setQuote(prev => ({ ...prev, items, total }));
  };

  const handleSearchProducts = async (args: { query: string, category?: string }) => {
    try {
      const results = await searchProductsInCatalog(args.query, args.category);
      return results;
    } catch (error) {
      console.error("Tool Error (searchProducts):", error);
      return { error: "No se pudo acceder al catálogo." };
    }
  };

  const resolveItemsFromCatalog = async (simpleItems: { code: string, quantity: number }[]): Promise<CartItem[]> => {
      const finalItems: CartItem[] = [];
      for (const item of simpleItems) {
         const products = await searchProductsInCatalog(item.code);
         let product = products.find(p => p.code === item.code) || 
                       products.find(p => p.code.toLowerCase() === item.code.toLowerCase()) ||
                       products.find(p => p.name.toLowerCase() === item.code.toLowerCase());

         if (!product && products.length > 0) {
            product = products[0];
         }

         if (product) {
             finalItems.push({ ...product, quantity: item.quantity });
         }
      }
      return finalItems;
  };

  const handleUpdateQuote = async (args: { items: { code: string, quantity: number }[] }) => {
    try {
        const finalItems = await resolveItemsFromCatalog(args.items);
        updateQuoteTotal(finalItems);
        if (finalItems.length > 0 && window.innerWidth < 1024) {
             setIsSidebarOpen(true);
        }
        return { status: 'success' };
    } catch (e: any) {
        return { status: 'error', message: e.message };
    }
  };

  const handleCreateOrder = async (args: { confirmed: boolean, items: { code: string, quantity: number }[] }) => {
    if (!args.confirmed) return { status: 'error', message: 'User did not confirm' };
    try {
      const finalItems = await resolveItemsFromCatalog(args.items);
      if (finalItems.length === 0) return { status: 'error', message: 'No valid items found' };
      const result = await createOrderInDux(finalItems);
      updateQuoteTotal(finalItems);
      setQuote(prev => ({ ...prev, status: 'confirmed' }));
      return { status: 'success', orderId: result.orderId };
    } catch (e: any) {
      return { status: 'error', message: e.message };
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || !geminiRef.current) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'system' ? 'model' : m.role, 
        parts: [{ text: m.content }]
      }));

      const aiResponseText = await geminiRef.current.sendMessage(
        history,
        userMsg.content,
        {
          searchProducts: handleSearchProducts,
          updateQuote: handleUpdateQuote,
          createOrder: handleCreateOrder
        }
      );

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: aiResponseText || "No he recibido una respuesta clara. ¿Podrías reformular tu solicitud?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      console.error("App Error:", error);
      let errorMessage = 'Lo siento, he tenido un problema al procesar tu mensaje.';
      
      // Detección específica de error de cuota (429)
      const errorStr = JSON.stringify(error);
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('quota')) {
        errorMessage = '⚠️ **Límite de cuota excedido.** Google está procesando tu activación de pago. Por favor, intenta de nuevo en unos minutos o espera 24hs para que la cuenta se estabilice.';
      } else if (error.message) {
        errorMessage += ` (Error: ${error.message})`;
      }
      
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: errorMessage,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = (code: string) => {
    const newItems = quote.items.filter(i => i.code !== code);
    updateQuoteTotal(newItems);
  };

  const updateItemQuantity = (code: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const newItems = quote.items.map(i => 
      i.code === code ? { ...i, quantity: newQuantity } : i
    );
    updateQuoteTotal(newItems);
  };

  if (isAdminMode) {
      return <AdminDashboard />;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-white z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-auto flex items-center justify-center">
                <img 
                    src="https://tecnoriegosrl.com.ar/wp-content/uploads/2021/04/logo-tecno-riego-srl.png" 
                    alt="Tecno Riego" 
                    className="h-full object-contain"
                />
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-lg leading-tight">Tecno Riego</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Asistente Técnico & Cotizador</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-3xl mx-auto ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={18} className="text-brand-700" />
                </div>
              )}
              
              <div
                className={`rounded-2xl px-5 py-3 shadow-sm max-w-[85%] sm:max-w-[75%] leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : msg.role === 'system' && msg.content.includes('⚠️') 
                      ? 'bg-amber-50 border border-amber-200 text-amber-800 rounded-bl-none italic'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                }`}
              >
                {formatMessageContent(msg.content)}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
                  <User size={18} className="text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-3xl mx-auto justify-start">
               <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot size={18} className="text-brand-700" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Procesando...</span>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Escribe tu consulta aquí..."
              className="flex-1 bg-gray-100 text-gray-900 placeholder-gray-500 border-0 rounded-full py-3.5 px-6 focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3.5 rounded-full shadow-lg hover:shadow-xl transition-all flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-2">
            La IA puede cometer errores. Verifica siempre los códigos y precios finales.
          </p>
        </div>
      </div>

      <div 
        className={`fixed inset-y-0 right-0 z-40 w-80 lg:relative lg:w-96 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <QuoteSummary 
            quote={quote} 
            onRemoveItem={removeItem} 
            onUpdateQuantity={updateItemQuantity}
            onClear={() => setQuote({ items: [], total: 0, status: 'draft' })}
            isProcessing={isLoading}
        />
      </div>
    </div>
  );
}

export default App;