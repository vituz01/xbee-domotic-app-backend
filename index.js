const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();

// CORS middleware - consente richieste da tutte le origini
app.use(cors());

// Middleware per parsing JSON
app.use(express.json());

// Percorso del file di configurazione
const CONFIG_FILE_PATH = path.join(__dirname, '../config/config.json');

// Inizializza oggetto configData
let configData = {};
let lastFileModified = null;

// Funzione per caricare la configurazione dal file
function loadConfigFromFile() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      console.warn(`Config file not found at ${CONFIG_FILE_PATH}`);
      return false;
    }

    const stats = fs.statSync(CONFIG_FILE_PATH);
    const currentModified = stats.mtime.getTime();

    // Controlla se il file è stato modificato
    if (lastFileModified === null || currentModified !== lastFileModified) {
      console.log('Config file changed, reloading...');
      
      const configFile = fs.readFileSync(CONFIG_FILE_PATH, "utf8");
      const parsedConfig = JSON.parse(configFile);
      
      // Aggiorna configData
      configData = {};
      
      // Mappa campi del file nell'oggetto configData
      for (const key in parsedConfig) {
        configData[key] = parsedConfig[key];
      }

      configData.mode = parsedConfig.mode || '';
      configData.webUrl = parsedConfig.webUrl || '';
      configData.chromecastName = parsedConfig.chromecastName || '';
      configData.youtubeVideoId = parsedConfig.youtubeVideoId || '';

      if (parsedConfig.lastUpdated) {
        configData.lastUpdated = new Date(parsedConfig.lastUpdated).toISOString().replace('T', ' ').substring(0, 23);
      } else {
        configData.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 23);
      }

      lastFileModified = currentModified;
      console.log('Config reloaded successfully');
      return true;
    }
    
    return false; // File non modificato
  } catch (error) {
    console.error('Error loading config file:', error);
    return false;
  }
}

// Funzione per salvare la configurazione nel file
function saveConfigToFile() {
  try {
    const configToSave = {
      mode: configData.mode,
      webUrl: configData.webUrl,
      chromecastName: configData.chromecastName,
      youtubeVideoId: configData.youtubeVideoId,
      lastUpdated: configData.lastUpdated
    };

    // Assicurati che la directory esista
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configToSave, null, 2), 'utf8');
    console.log('Config saved to file');
    return true;
  } catch (error) {
    console.error('Error saving config file:', error);
    return false;
  }
}

// Carica la configurazione iniziale
loadConfigFromFile();

// Polling del file di configurazione ogni 100ms
const configPollingInterval = setInterval(() => {
  loadConfigFromFile();
}, 100);

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
    if ((!data.chromecast_name || typeof data.chromecast_name !== 'string') || (!data.youtube_video_id || typeof data.youtube_video_id !== 'string')) {
      return { valid: false, error: 'chromecast_name/youtube_video_id required for chromecast mode' };
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

    const { modalità_corrente, web_url, chromecast_name,  youtube_video_id} = req.body;

    // Aggiorna la configurazione
    configData.mode = modalità_corrente;

    // Aggiorna i campi specifici per ogni modalità
    switch (modalità_corrente) {
      case 'web':
        configData.webUrl = web_url;
        break;
      case 'chromecast':
        configData.chromecastName = chromecast_name;
        configData.youtubeVideoId = youtube_video_id;
        break;
      case 'led':
        // Per la modalità LED non sono necessari campi aggiuntivi
        break;
    }

    // Aggiorna il timestamp
    updateTimestamp();

    // Salva la configurazione nel file
    saveConfigToFile();

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
        response.youtube_video_id = configData.youtubeVideoId;
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
      timestamp: configData.lastUpdated,
      config_file_path: CONFIG_FILE_PATH,
      config_loaded: Object.keys(configData).length > 0
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

// Cleanup quando l'applicazione viene chiusa
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  clearInterval(configPollingInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  clearInterval(configPollingInterval);
  process.exit(0);
});

// Avvio del server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Config file polling every 100ms from: ${CONFIG_FILE_PATH}`);
});