import React, { useState } from 'react';
import { Key } from 'lucide-react';

interface Props {
  onSave: (key: string) => void;
}

export const ApiKeyModal: React.FC<Props> = ({ onSave }) => {
  const [inputKey, setInputKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputKey.trim()) {
      onSave(inputKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4 text-brand-700">
          <div className="p-2 bg-brand-100 rounded-lg">
            <Key size={24} />
          </div>
          <h2 className="text-xl font-bold">Configuración Inicial</h2>
        </div>
        
        <p className="text-gray-600 mb-6 text-sm">
          Para utilizar el Agente de Riego AI, necesitas una API Key de Google Gemini.
          Esta clave se usará temporalmente en tu navegador y no se guardará en ningún servidor externo.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            Comenzar
          </button>
        </form>
        
        <div className="mt-4 text-xs text-gray-400 text-center">
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-brand-600">
            Obtener API Key aquí
          </a>
        </div>
      </div>
    </div>
  );
};