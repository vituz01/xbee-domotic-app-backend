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
let configPollingInterval = null; // Modificato per gestire l'intervallo

// Funzione per caricare la configurazione dal file
function loadConfigFromFile() {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      console.warn(`Config file not found at ${CONFIG_FILE_PATH}`);
      
      // Interrompi il polling se il file non esiste
      if (configPollingInterval) {
        console.log('Stopping config file polling - file not found');
        clearInterval(configPollingInterval);
        configPollingInterval = null;
      }
      
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
  configData.chromecastName = parsedConfig.chromecastName || '';
  configData.youtubeVideoId = parsedConfig.youtubeVideoId || '';
  configData.ppt_email = parsedConfig.ppt_email || '';

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
    
    // Interrompi il polling anche in caso di errore di lettura
    if (configPollingInterval) {
      console.log('Stopping config file polling - error reading file');
      clearInterval(configPollingInterval);
      configPollingInterval = null;
    }
    
    return false;
  }
}

// Funzione per salvare la configurazione nel file
function saveConfigToFile() {
  try {
    const configToSave = {
      mode: configData.mode,
      chromecastName: configData.chromecastName,
      youtubeVideoId: configData.youtubeVideoId,
      ppt_email: configData.ppt_email,
      lastUpdated: configData.lastUpdated
    };

    // Assicurati che la directory esista
    const configDir = path.dirname(CONFIG_FILE_PATH);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(configToSave, null, 2), 'utf8');
    console.log('Config saved to file');
    
    // Riavvia il polling se era stato fermato e ora il file esiste di nuovo
    if (!configPollingInterval) {
      console.log('Restarting config file polling');
      startConfigPolling();
    }
    
    return true;
  } catch (error) {
    console.error('Error saving config file:', error);
    return false;
  }
}

// Funzione per avviare il polling della configurazione
function startConfigPolling() {
  if (configPollingInterval) {
    clearInterval(configPollingInterval);
  }
  
  configPollingInterval = setInterval(() => {
    loadConfigFromFile();
  }, 100);
  
  console.log('Config file polling started');
}

// Carica la configurazione iniziale
const initialLoadSuccess = loadConfigFromFile();

// Avvia il polling solo se il file esiste inizialmente
if (initialLoadSuccess || fs.existsSync(CONFIG_FILE_PATH)) {
  startConfigPolling();
} else {
  console.log('Config file not found - polling not started');
}

// Funzione per aggiornare il timestamp
function updateTimestamp() {
  configData.lastUpdated = new Date().toISOString().replace('T', ' ').substring(0, 23);
}

// Funzione per validare i dati di configurazione
function validateConfigData(data) {
  const { modalità_corrente } = data;

  if (!modalità_corrente || !['led', 'chromecast', 'powerpoint'].includes(modalità_corrente)) {
    return { valid: false, error: 'modalità_corrente must be: led, chromecast or powerpoint' };
  }

  if (modalità_corrente === 'chromecast') {
    if ((!data.chromecast_name || typeof data.chromecast_name !== 'string') || (!data.youtube_video_id || typeof data.youtube_video_id !== 'string')) {
      return { valid: false, error: 'chromecast_name/youtube_video_id required for chromecast mode' };
    }
  }

  if (modalità_corrente === 'powerpoint') {
    if (!data.ppt_email || typeof data.ppt_email !== 'string') {
      return { valid: false, error: 'ppt_email required for powerpoint mode' };
    }
    // Simple email validation
    if (!/^\S+@\S+\.\S+$/.test(data.ppt_email)) {
      return { valid: false, error: 'ppt_email must be a valid email address' };
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
      case 'chromecast':
        response.chromecast_name = configData.chromecastName;
        response.youtube_video_id = configData.youtubeVideoId;
        break;
      case 'powerpoint':
        response.ppt_email = configData.ppt_email;
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

    const { modalità_corrente, chromecast_name, youtube_video_id, ppt_email } = req.body;

    // Aggiorna la configurazione
    configData.mode = modalità_corrente;

    // Aggiorna i campi specifici per ogni modalità
    switch (modalità_corrente) {
      case 'chromecast':
        configData.chromecastName = chromecast_name;
        configData.youtubeVideoId = youtube_video_id;
        break;
      case 'powerpoint':
        configData.ppt_email = ppt_email;
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
      case 'chromecast':
        response.chromecast_name = configData.chromecastName;
        response.youtube_video_id = configData.youtubeVideoId;
        break;
      case 'powerpoint':
        response.ppt_email = configData.ppt_email;
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
      config_loaded: Object.keys(configData).length > 0,
      polling_active: configPollingInterval !== null // Aggiunto stato del polling
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
  if (configPollingInterval) {
    clearInterval(configPollingInterval);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down server...');
  if (configPollingInterval) {
    clearInterval(configPollingInterval);
  }
  process.exit(0);
});

// Avvio del server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST ||'0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on host ${HOST} and port ${PORT}`);
  console.log(`Config file path: ${CONFIG_FILE_PATH}`);
  if (configPollingInterval) {
    console.log('Config file polling active (every 100ms)');
  } else {
    console.log('Config file polling inactive - file not found');
  }
});

module.exports = app; // Esporta l'app per test o altri usi