import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

const searchProductsTool: FunctionDeclaration = {
  name: "searchProducts",
  description: "Busca productos en el catálogo. Usa 'category' siempre que sea posible para filtrar resultados y mejorar la precisión.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "Palabras clave del producto (Marca, Modelo, Dimensión).",
      },
      category: {
        type: Type.STRING,
        description: "Filtro de categoría opcional (ej: 'Válvulas', 'Rotores', 'Programadores', 'Goteo', 'Accesorios'). Ayuda a reducir resultados irrelevantes.",
      },
    },
    required: ["query"],
  },
};

const updateQuoteTool: FunctionDeclaration = {
  name: "updateQuote",
  description: "Actualiza el panel visual de la cotización (borrador) visible para el usuario. Úsalo SIEMPRE que propongas productos o el usuario modifique cantidades. Envía la lista COMPLETA actual de productos.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: "Lista COMPLETA de productos para mostrar en el panel lateral.",
        items: {
            type: Type.OBJECT,
            properties: {
                code: { type: Type.STRING },
                quantity: { type: Type.NUMBER }
            }
        }
      }
    },
    required: ["items"],
  },
};

const createOrderTool: FunctionDeclaration = {
  name: "createOrder",
  description: "Finaliza la cotización y crea el pedido en el sistema (Dux). Solo usar cuando el cliente confirme explícitamente.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmed: {
        type: Type.BOOLEAN,
        description: "Debe ser true para proceder.",
      },
      items: {
        type: Type.ARRAY,
        description: "Lista final de productos a pedir.",
        items: {
            type: Type.OBJECT,
            properties: {
                code: { type: Type.STRING },
                quantity: { type: Type.NUMBER }
            }
        }
      }
    },
    required: ["confirmed", "items"],
  },
};

const tools: Tool[] = [
  {
    functionDeclarations: [searchProductsTool, updateQuoteTool, createOrderTool],
  },
];

export class GeminiService {
  private ai: GoogleGenAI;
  private modelName = 'gemini-3-flash-preview'; 

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async sendMessage(
    history: { role: string; parts: { text?: string }[] }[],
    newMessage: string,
    toolHandlers: {
      searchProducts: (args: any) => Promise<any>;
      updateQuote: (args: any) => Promise<any>;
      createOrder: (args: any) => Promise<any>;
    }
  ) {
    const chat = this.ai.chats.create({
      model: this.modelName,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools,
        temperature: 0.3, 
      },
      history: history.map(h => ({
        role: h.role,
        parts: h.parts
      }))
    });

    try {
      let result = await chat.sendMessage({ message: newMessage });
      
      let maxTurns = 5; 
      let toolExecuted = false;

      while (result.functionCalls && result.functionCalls.length > 0 && maxTurns > 0) {
        maxTurns--;
        toolExecuted = true;
        const functionCalls = result.functionCalls;
        const responseParts = [];
        
        for (const call of functionCalls) {
            let functionResult;
            try {
                if (call.name === 'searchProducts') {
                    functionResult = await toolHandlers.searchProducts(call.args);
                } else if (call.name === 'updateQuote') {
                    functionResult = await toolHandlers.updateQuote(call.args);
                } else if (call.name === 'createOrder') {
                    functionResult = await toolHandlers.createOrder(call.args);
                } else {
                    functionResult = { error: "Unknown function" };
                }
            } catch (toolError: any) {
                console.warn(`Tool execution error for ${call.name}:`, toolError);
                functionResult = { error: "Tool execution failed" };
            }

            responseParts.push({
                functionResponse: {
                    name: call.name,
                    response: { result: functionResult },
                    id: call.id
                }
            });
        }

        // Re-inicializamos para cada llamada de herramienta para asegurar que usamos la key fresca si cambiara
        result = await chat.sendMessage({ message: responseParts as any });
      }

      if (result.text && result.text.trim() === "") {
        return undefined;
      }

      return result.text;

    } catch (error: any) {
      // Propagar el error para que App.tsx lo maneje
      throw error;
    }
  }
}