// Define um nome para o cache
const CACHE_NAME = 'notifica-pwa-cache-v7'; // Nova versão do cache para forçar atualização

// Lista de arquivos para serem cacheados
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/style.css',
  '/manifest.json',
  // Ícones do PWA
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png',
  // Ícones de plataformas locais (apenas Perfect Pay agora)
  '/assets/icons/perfectpay-icon.png',
  // Novos ícones adicionados (se forem locais)
  '/assets/icons/stripe-icon.png', // Adicionado
  '/assets/icons/transferwise-icon.png', // Adicionado
  // Sons de notificação (se forem locais)
  '/assets/sounds/notification1.mp3', // Adicionado
  '/assets/sounds/notification2.mp3' // Adicionado
];

// Evento de instalação: Cachear os arquivos estáticos
self.addEventListener('install', event => {
  console.log('Service Worker: Evento de instalação - Iniciando cache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto', CACHE_NAME);
        return cache.addAll(urlsToCache).catch(error => {
          console.error('Service Worker: Falha ao cachear alguns recursos:', error);
          error.message.split(',').forEach(failedUrl => console.error(`Falhou ao cachear: ${failedUrl.trim()}`));
        });
      })
      .then(() => self.skipWaiting()) // Força o Service Worker a ativar imediatamente
  );
});

// Evento de ativação: Limpar caches antigos
self.addEventListener('activate', event => {
  console.log('Service Worker: Evento de ativação - Limpando caches antigos...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('ServiceWorker: Removendo cache antigo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => clients.claim()) // Permite que o Service Worker controle os clientes imediatamente
  );
});

// Evento fetch: Servir do cache primeiro, depois da rede
self.addEventListener('fetch', event => {
  // Apenas para requisições GET e de mesmo-origem
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se encontrado
        if (response) {
          return response;
        }

        // Se não, tenta buscar na rede e cacheia a resposta
        return fetch(event.request).then(
          responseNetwork => {
            // Verifica se a resposta é válida
            if (!responseNetwork || responseNetwork.status !== 200 || responseNetwork.type !== 'basic') {
              return responseNetwork;
            }

            // Clona a resposta porque um stream de resposta só pode ser consumido uma vez
            const responseToCache = responseNetwork.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return responseNetwork;
          }
        ).catch(error => {
          console.error('Fetch falhou para:', event.request.url, error);
          // Opcional: retornar uma página offline aqui, se houver
          // return caches.match('/offline.html');
        });
      })
  );
});

// Evento push: Ouve por notificações push enviadas do servidor
self.addEventListener('push', event => {
  const data = event.data.json();
  console.log('Push recebido:', data);
  const title = data.title || 'Nova Notificação';
  const options = {
    body: data.body || 'Você tem uma nova mensagem.',
    icon: data.icon || 'assets/icons/icon-192x192.png',
    badge: data.badge || 'assets/icons/icon-72x72.png',
    vibrate: data.vibrate || [200, 100, 200],
    data: {
      url: data.url || '/' // URL para abrir ao clicar na notificação
    },
    // `sound` só funciona se o arquivo estiver no cache ou acessível pela rede
    sound: data.sound || undefined
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Evento notificationclick: Lida com o clique na notificação
self.addEventListener('notificationclick', event => {
  console.log('Notificação clicada:', event.notification);
  event.notification.close(); // Fecha a notificação

  // Abre a URL associada à notificação
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});