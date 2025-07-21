const express = require('express');
const cors = require('cors');
const app = express();

// CORS middleware - consente richieste da tutte le origini
app.use(cors());

// Middleware per parsing JSON
app.use(express.json());

// Simulazione dei dati di configurazione in memoria
// Nell'applicazione reale, questi dati vengono gestiti dal file pollato dallo script Python
let configData = {
  mode: 'led', // Modalità corrente: 'led', 'web', 'chromecast'
  webUrl: 'https://youtube.com',
  chromecastName: 'Chromecast name',
  lastUpdated: new Date().toISOString().replace('T', ' ').substring(0, 23)
};

// Funzione per aggiornare il timestamp
function updateTimestamp() {
  configData.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 23);
}

// Funzione per validare i dati di configurazione
function validateConfigData(data) {
  const { modalità_corrente } = data;

  if (!modalità_corrente || !['led', 'web', 'chromecast'].includes(modalità_corrente)) {
    return { valid: false, error: 'modalità_corrente must be: led, web or chromecast' };
  }

  if (modalità_corrente === 'web') {
    if (!data.web_url || typeof data.web_url !== 'string') {
      return { valid: false, error: 'web_url required for web mode' };
    }
    // Validazione URL base
    try {
      new URL(data.web_url);
    } catch {
      return { valid: false, error: 'web_url must be a valid url' };
    }
  }

  if (modalità_corrente === 'chromecast') {
    if (!data.chromecast_name || typeof data.chromecast_name !== 'string') {
      return { valid: false, error: 'chromecast_name  required for chromecast mode' };
    }
  }

  return { valid: true };
}

// GET /api/config
app.get('/api/config', (req, res) => {
  try {
    let response = {
      modalità_corrente: configData.mode,
      last_updated: configData.lastUpdated
    };

    // Aggiungi campi specifici in base alla modalità corrente
    switch (configData.mode) {
      case 'web':
        response.web_url = configData.webUrl;
        break;
      case 'chromecast':
        response.chromecast_name = configData.chromecastName;
        break;
      case 'led':
        // Per la modalità LED non sono necessari campi aggiuntivi
        break;
      default:
        return res.status(500).json({ error: 'Mode not valid' });
    }

    response.status = 'success';

    res.json(response);
  } catch (error) {
    console.error('Error while fetching current config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/config
app.post('/api/config', (req, res) => {
  try {
    // Validazione dei dati in input
    const validation = validateConfigData(req.body);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { modalità_corrente, web_url, chromecast_name } = req.body;

    // Aggiorna la configurazione
    configData.mode = modalità_corrente;

    // Aggiorna i campi specifici per ogni modalità
    switch (modalità_corrente) {
      case 'web':
        configData.webUrl = web_url;
        break;
      case 'chromecast':
        configData.chromecastName = chromecast_name;
        break;
      case 'led':
        // Per la modalità LED non sono necessari campi aggiuntivi
        break;
    }

    // Aggiorna il timestamp
    updateTimestamp();

    // Restituisci la configurazione aggiornata
    let response = {
      modalità_corrente: configData.mode,
      last_updated: configData.lastUpdated
    };

    // Aggiungi campi specifici nella risposta
    switch (configData.mode) {
      case 'web':
        response.web_url = configData.webUrl;
        break;
      case 'chromecast':
        response.chromecast_name = configData.chromecastName;
        break;
    }

    response.status = 'success';

    res.json(response);
    
    console.log(`Updated configuration: mode=${modalità_corrente}, timestamp=${configData.lastUpdated}`);

  } catch (error) {
    console.error('Error during configuration update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/status
app.get('/api/status', (req, res) => {
  try {
    let response = {
      status: 'running',
      timestamp: configData.lastUpdated
    };
    res.json(response);
  } catch (error) {
    console.error('Error while fetching app status: ', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware per gestire richieste non trovate
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Gestione errori globale
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Avvio del server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;