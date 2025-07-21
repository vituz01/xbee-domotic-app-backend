# xbee-domotic-app-backend
This project concerns the development of the backend for a domotic web application used to configure and interact with a local network composed by a coordinator micro-controller, 3 Xbee modules and a touch sensor.  

## Core Functionality
The API manages three different operational modes:

- LED mode: Basic LED display functionality
- Web mode: Displays web content (requires a URL)
- Chromecast mode: Connects to a Chromecast device (requires device name)

## API Endpoints
- GET /api/config - Retrieves the current configuration including:

1. Current mode (modalità_corrente)
2. Last update timestamp
3. Mode-specific parameters (web_url or chromecast_name when applicable)

- POST /api/config - Updates the configuration with validation:

1. Ensures the mode is valid (led/web/chromecast)
2. Validates required parameters for each mode
3. Updates timestamps automatically

- GET /api/status - Returns basic server status information

## Key Features

- In-memory data storage for configuration through a file shared with the Python script controlling the Xbee network
- Request validation ensuring proper mode selection and required parameters
- CORS support for cross-origin requests
- Comprehensive error handling with appropriate HTTP status codes

## Architecture Notes
The code is part of a larger system where a Python script polls and manages configuration data, while this Express server provides a REST interface for configuration management. It's designed to control the configuration management system through which the user can switch between showing LED patterns, web content, or Chromecast streams.