/* ============================================================
   🎨 DIFERENTES FORMATOS DE MENSAGENS WHATSAPP BUSINESS API
   ============================================================ */

// 1. 📋 LISTA SUSPENSA (até 10 opções) - Melhor para muitas opções
function createListMessage(senderId, welcomeMessage, options) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "list",
      header: {
        type: "text",
        text: "🎓 Matriz Class Jurídico"
      },
      body: {
        text: welcomeMessage
      },
      footer: {
        text: "Selecione uma opção abaixo 👇"
      },
      action: {
        button: "Ver Opções",
        sections: [
          {
            title: "Menu Principal",
            rows: options.map((opt, i) => ({
              id: `option_${opt.id}`,
              title: opt.message.substring(0, 24), // máx 24 chars
              description: opt.message.length > 24 ? opt.message.substring(24, 72) : undefined // máx 72 chars
            }))
          }
        ]
      }
    }
  };
}

// 2. 🔘 BOTÕES DE RESPOSTA RÁPIDA (até 3 opções) - Melhor para poucas opções
function createQuickReplyButtons(senderId, welcomeMessage, options) {
  // Pega apenas as 3 primeiras opções
  const limitedOptions = options.slice(0, 3);
  
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "🎓 Matriz Class Jurídico"
      },
      body: {
        text: welcomeMessage
      },
      footer: {
        text: "Escolha uma das opções:"
      },
      action: {
        buttons: limitedOptions.map((opt, i) => ({
          type: "reply",
          reply: {
            id: `btn_${opt.id}`,
            title: opt.message.substring(0, 20) // máx 20 chars
          }
        }))
      }
    }
  };
}

// 3. 🌐 BOTÕES DE AÇÃO (até 2 botões) - Para ações externas
function createCallToActionButtons(senderId, welcomeMessage) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "🎓 Matriz Class Jurídico"
      },
      body: {
        text: welcomeMessage
      },
      footer: {
        text: "Como podemos ajudar?"
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "falar_atendimento",
              title: "💬 Falar c/ Suporte"
            }
          },
          {
            type: "reply",
            reply: {
              id: "ver_cursos",
              title: "📚 Ver Cursos"
            }
          }
        ]
      }
    }
  };
}

// 4. 📱 BOTÕES MISTOS (Resposta + URL/Telefone)
function createMixedButtons(senderId, welcomeMessage) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: welcomeMessage
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "mais_info",
              title: "ℹ️ Mais Infos"
            }
          },
          {
            type: "url",
            url: {
              text: "🌐 Site",
              url: "https://matrizclass.com.br"
            }
          },
          {
            type: "phone_number",
            phone_number: {
              text: "📞 Ligar",
              phone_number: "+5571999999999"
            }
          }
        ]
      }
    }
  };
}

// 5. 📍 MENSAGEM COM LOCALIZAÇÃO
function createLocationMessage(senderId) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "location",
    location: {
      latitude: -12.9714, // Salvador
      longitude: -38.5014,
      name: "Matriz Class Jurídico",
      address: "Salvador, Bahia"
    }
  };
}

// 6. 🖼️ MENSAGEM COM IMAGEM E BOTÕES
function createImageWithButtons(senderId, imageUrl, caption) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "image",
        image: {
          link: imageUrl
        }
      },
      body: {
        text: caption
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: "interessado",
              title: "✋ Tenho interesse"
            }
          },
          {
            type: "reply",
            reply: {
              id: "mais_detalhes",
              title: "📋 Mais detalhes"
            }
          }
        ]
      }
    }
  };
}

// 7. 📄 DOCUMENTO COM BOTÕES
function createDocumentWithButtons(senderId, documentUrl, filename, caption) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "document",
    document: {
      link: documentUrl,
      filename: filename,
      caption: caption
    }
  };
}

// 8. 🎥 VÍDEO COM BOTÕES
function createVideoMessage(senderId, videoUrl, caption) {
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "video",
    video: {
      link: videoUrl,
      caption: caption
    }
  };
}

/* ============================================================
   🤔 QUAL FORMATO ESCOLHER?
   ============================================================ */

/*
📋 LISTA SUSPENSA (List Message):
✅ 4-10 opções
✅ Quando precisar de descrições
✅ Múltiplas categorias
✅ Menu completo

🔘 BOTÕES DE RESPOSTA (Quick Reply):
✅ 2-3 opções principais  
✅ Resposta rápida
✅ Ações simples
✅ Visual mais limpo

🌐 BOTÕES DE AÇÃO (CTA):
✅ Ações externas (site, telefone)
✅ Combinar resposta + ação
✅ Call-to-action forte

📱 MENSAGENS RICAS:
✅ Com imagens, vídeos, documentos
✅ Mais engajamento visual
✅ Demonstrar produtos/serviços
*/

/* ============================================================
   💡 RECOMENDAÇÃO PARA SEU CASO:
   ============================================================ */

// Para 4 opções como você tem:
// OPÇÃO 1: Lista suspensa (atual) ✅ 
// OPÇÃO 2: Botões de resposta rápida (mais direto)
// OPÇÃO 3: Combinar - 3 botões principais + "Outras opções" que abre lista

function createHybridApproach(senderId, welcomeMessage, allOptions) {
  // 3 opções principais como botões
  const mainOptions = allOptions.slice(0, 3);
  
  return {
    messaging_product: "whatsapp",
    to: senderId,
    type: "interactive",
    interactive: {
      type: "button",
      header: {
        type: "text",
        text: "🎓 Matriz Class Jurídico"
      },
      body: {
        text: welcomeMessage
      },
      footer: {
        text: "Escolha uma opção:"
      },
      action: {
        buttons: [
          ...mainOptions.map(opt => ({
            type: "reply",
            reply: {
              id: `btn_${opt.id}`,
              title: opt.message.substring(0, 20)
            }
          })),
          {
            type: "reply",
            reply: {
              id: "outras_opcoes",
              title: "➕ Outras opções"
            }
          }
        ]
      }
    }
  };
}
