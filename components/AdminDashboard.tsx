import React from 'react';
import { ShieldAlert } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-gray-100 p-3 rounded-full">
            <ShieldAlert className="text-gray-600" size={32} />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Panel de Administración</h2>
        <p className="text-gray-600 text-sm">
          La funcionalidad de logs en tiempo real ha sido deshabilitada para optimizar el rendimiento y la estabilidad del servidor.
        </p>
        <a href="/" className="mt-6 inline-block text-brand-600 hover:text-brand-800 text-sm font-medium">
          &larr; Volver al chat
        </a>
      </div>
    </div>
  );
};