Consul ApiMonitor
A minimalist, production-ready API monitoring tool for the terminal, built with Node.js. This project demonstrates advanced features like a Text User Interface (TUI) dashboard, real-time status updates, email notifications, and detailed metrics, all wrapped in a sleek grayscale aesthetic with ASCII animations.
Features

Real-Time Monitoring: Tracks API availability with configurable intervals using node-cron.
TUI Dashboard: Displays live status updates (uptime, response time, failures) using blessed.
Detailed Metrics: Includes uptime percentage, average response time, response time histograms, and recent failure logs.
Email Alerts: Sends notifications for API failures via nodemailer (configurable in config.json).
Persistent Storage: Saves status history to status.json for analysis.
Exponential Backoff: Prevents server overload by retrying failed APIs with increasing delays.
CLI Support: Customizable via command-line arguments with yargs (e.g., --config).
Minimalist Design: Grayscale color scheme and ASCII spinners for a clean, professional UX.
Extensible Architecture: Event-driven design with EventEmitter for easy integration.
Robust Logging: Logs to file and console with configurable levels (info, debug, error).

Screenshots
Add screenshots here to showcase the TUI dashboard, welcome screen, and menu navigation.

Welcome Screen: Displays project branding and version.
TUI Dashboard: Real-time status updates.
Menu: Minimalist navigation with ASCII spinners.

Installation
Prerequisites

Node.js: Version 18.x or higher (20.x LTS recommended).
npm: For dependency installation.

Setup

Clone the repository:
git clone <your-repo-url>
cd monitor-sys/monitoramento-terminal/Utils


Install dependencies:
npm install axios inquirer chalk node-cron nodemailer blessed yargs


Create required files:

urls.json: Initialize with an empty URL list:{"urls": []}


config.json: Use the provided configuration or customize as needed:{
  "intervalMinutes": 5,
  "requestTimeoutMs": 5000,
  "logFile": "./monitor.log",
  "statusFile": "./status.json",
  "logLevel": "info",
  "email": {
    "enabled": false,
    "smtp": {
      "host": "smtp.example.com",
      "port": 587,
      "secure": false
    },
    "auth": {
      "user": "user@example.com",
      "pass": "password"
    },
    "from": "monitor@example.com",
    "to": "alerts@example.com"
  },
  "backoff": {
    "initialDelayMs": 1000,
    "maxDelayMs": 60000
  }
}




Ensure file permissions:
chmod -R u+rw .



Running the Application
Start the monitor:
node interface.js

Or specify a custom config file:
node interface.js --config ./config.json

Usage

Welcome Screen: Press Enter to start.
Main Menu: Navigate with arrow keys and select options with Enter.
List URLs: View registered APIs.
View Status: Open the TUI dashboard for real-time status.
Add URL: Register a new API endpoint.
Remove URL: Delete an existing API.
Start Monitoring: Begin checking APIs.
Help: View detailed usage instructions.
Exit: Quit the application.


TUI Dashboard: Press Enter to return to the menu, or q/Ctrl+C to exit.
Logs: Check monitor.log for detailed activity and errors.
Status History: View historical data in status.json.

Configuration
Edit config.json to customize:

intervalMinutes: Frequency of API checks.
requestTimeoutMs: Timeout for API requests.
logLevel: Set to debug for verbose logging.
email: Enable and configure SMTP for alerts.
backoff: Adjust retry delays for failed APIs.

Project Structure
monitor-sys/monitoramento-terminal/Utils/
├── interface.js      # Terminal UI and menu logic
├── monitor.js       # Backend monitoring logic
├── config.json      # Configuration file
├── urls.json       # List of monitored URLs
├── monitor.log     # Log file (auto-generated)
├── status.json     # Status history (auto-generated)
└── README.md       # Project documentation

Portfolio Highlights
This project showcases:

Technical Expertise: Event-driven architecture, parallel API requests, and advanced metrics.
Robustness: Comprehensive error handling, persistent storage, and graceful shutdown.
User Experience: Minimalist TUI with real-time updates and ASCII animations.
Scalability: Configurable settings and extensible design for production use.
Problem-Solving: Debugged issues like log stream initialization (demonstrating resilience).

Contributing
Feel free to fork the repository, submit issues, or create pull requests to enhance features like:

Web dashboard integration.
Database storage for metrics.
Additional notification channels (e.g., Slack, SMS).

License
MIT License. See LICENSE for details.
