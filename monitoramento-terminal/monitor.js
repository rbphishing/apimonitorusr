import axios from 'axios';
import fs from 'fs/promises';
import cron from 'node-cron';
import chalk from 'chalk';
import { URL } from 'url';
import { createWriteStream } from 'fs';
import nodemailer from 'nodemailer';
import EventEmitter from 'events';

const monitorEvents = new EventEmitter();

const DEFAULT_CONFIG = {
  intervalMinutes: 5,
  requestTimeoutMs: 5000,
  logFile: './monitor.log',
  statusFile: './status.json',
  logLevel: 'info',
  email: {
    enabled: false,
    smtp: { host: 'smtp.example.com', port: 587, secure: false },
    auth: { user: 'user@example.com', pass: 'password' },
    from: 'monitor@example.com',
    to: 'alerts@example.com',
  },
  backoff: { initialDelayMs: 1000, maxDelayMs: 60000 },
};

const apiStatus = new Map();

let logStream = createWriteStream(DEFAULT_CONFIG.logFile, { flags: 'a' });
const log = (message, level = 'info') => {
  if (level === 'debug' && config.logLevel !== 'debug') return;
  const timestamp = new Date().toISOString();
  if (logStream) {
    logStream.write(`[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
  }
  if (level !== 'debug') console.log(chalk.gray(`[${level.toUpperCase()}] ${message}`));
};

let config = DEFAULT_CONFIG;
async function loadConfig() {
  try {
    const data = await fs.readFile('./config.json', 'utf-8');
    config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    if (logStream) logStream.end();
    logStream = createWriteStream(config.logFile, { flags: 'a' });
    log('Configuration loaded from config.json', 'info');
  } catch (error) {
    log(`Failed to load config: ${error.message}, using default configuration`, 'warn');
  }
}

const transporter = nodemailer.createTransport(config.email.smtp, {
  auth: config.email.auth,
});
async function sendAlert(url, error) {
  if (!config.email.enabled) return;
  try {
    await transporter.sendMail({
      from: config.email.from,
      to: config.email.to,
      subject: `API Monitor Alert: ${url} Offline`,
      text: `URL: ${url}\nError: ${error}\nTime: ${new Date().toISOString()}`,
    });
    log(`Alert sent for ${url}`, 'info');
  } catch (err) {
    log(`Failed to send alert: ${err.message}`, 'error');
  }
}

const showProgress = async (durationMs, message) => {
  const steps = 20;
  const interval = durationMs / steps;
  process.stdout.write(chalk.gray(`${message} [`));
  for (let i = 0; i < steps; i++) {
    process.stdout.write('█');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  process.stdout.write(']\n');
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const initStatus = (url) => ({
  status: 'unknown',
  lastChecked: null,
  uptimeCount: 0,
  totalChecks: 0,
  avgResponseTime: 0,
  failures: [],
  responseTimes: [],
});

async function saveStatus() {
  const statusData = {};
  for (const [url, status] of apiStatus) {
    statusData[url] = { ...status, lastChecked: status.lastChecked?.toISOString() };
  }
  try {
    await fs.writeFile(config.statusFile, JSON.stringify(statusData, null, 2));
  } catch (error) {
    log(`Failed to save status: ${error.message}`, 'error');
  }
}

export async function monitorApiBack() {
  await loadConfig();
  try {
    const fileData = await fs.readFile('./urls.json', 'utf-8');
    const { urls } = JSON.parse(fileData);

    if (!urls || urls.length === 0) {
      log('No URLs found in urls.json', 'error');
      monitorEvents.emit('error', 'No URLs found');
      return;
    }

    const validUrls = urls.filter((url) => {
      if (!isValidUrl(url)) {
        log(`Invalid URL skipped: ${url}`, 'warn');
        return false;
      }
      apiStatus.set(url, initStatus(url));
      return true;
    });

    if (validUrls.length === 0) {
      log('No valid URLs to monitor', 'error');
      monitorEvents.emit('error', 'No valid URLs');
      return;
    }

    const cronExpression = `*/${config.intervalMinutes} * * * *`;
    log(`Monitoring ${validUrls.length} URLs every ${config.intervalMinutes} minutes`, 'info');

    await showProgress(1000, 'Initializing monitor');

    const backoffDelays = new Map(validUrls.map((url) => [url, 0]));

    const task = cron.schedule(cronExpression, async () => {
      const startTime = Date.now();
      log(`Check started at ${new Date().toLocaleTimeString()}`, 'info');

      const results = await Promise.allSettled(
        validUrls.map(async (url) => {
          if (backoffDelays.get(url) > 0) {
            log(`Skipping ${url} due to backoff`, 'debug');
            return;
          }
          const startRequest = Date.now();
          try {
            const response = await axios.get(url, { timeout: config.requestTimeoutMs });
            const responseTime = Date.now() - startRequest;
            const statusData = apiStatus.get(url);
            statusData.status = 'online';
            statusData.lastChecked = new Date();
            statusData.uptimeCount += 1;
            statusData.totalChecks += 1;
            statusData.avgResponseTime =
              (statusData.avgResponseTime * (statusData.totalChecks - 1) + responseTime) /
              statusData.totalChecks;
            statusData.responseTimes.push(responseTime);
            if (statusData.responseTimes.length > 100) statusData.responseTimes.shift();
            backoffDelays.set(url, 0);
            apiStatus.set(url, statusData);
            log(`${url} online (Status: ${response.status}, Time: ${responseTime}ms)`, 'info');
            monitorEvents.emit('status', url, 'online', responseTime);
          } catch (error) {
            const responseTime = Date.now() - startRequest;
            const statusData = apiStatus.get(url);
            statusData.status = 'offline';
            statusData.lastChecked = new Date();
            statusData.totalChecks += 1;
            statusData.avgResponseTime =
              (statusData.avgResponseTime * (statusData.totalChecks - 1) + responseTime) /
              statusData.totalChecks;
            statusData.responseTimes.push(responseTime);
            statusData.failures.push({ time: new Date().toISOString(), error: error.message });
            if (statusData.responseTimes.length > 100) statusData.responseTimes.shift();
            if (statusData.failures.length > 100) statusData.failures.shift();
            const delay = backoffDelays.get(url) || config.backoff.initialDelayMs;
            backoffDelays.set(url, Math.min(delay * 2, config.backoff.maxDelayMs));
            apiStatus.set(url, statusData);
            log(`${url} offline (Error: ${error.message})`, 'error');
            monitorEvents.emit('status', url, 'offline', responseTime, error.message);
            await sendAlert(url, error.message);
          }
        })
      );

      await saveStatus();
      const duration = Date.now() - startTime;
      log(`Check completed in ${duration}ms at ${new Date().toLocaleTimeString()}`, 'info');
    });

    process.on('SIGINT', () => {
      log('Stopping monitoring...', 'info');
      task.stop();
      if (logStream) logStream.end();
      process.exit(0);
    });

  } catch (error) {
    log(`Error starting monitor: ${error.message}`, 'error');
    monitorEvents.emit('error', error.message);
  }
}

export function getApiStatus() {
  const statusArray = [];
  for (const [url, status] of apiStatus) {
    statusArray.push({
      url,
      status: status.status,
      lastChecked: status.lastChecked?.toLocaleTimeString() || 'Never',
      uptime: status.totalChecks > 0 ? ((status.uptimeCount / status.totalChecks) * 100).toFixed(2) + '%' : 'N/A',
      avgResponseTime: status.avgResponseTime.toFixed(2) + 'ms',
      recentFailures: status.failures.slice(-3),
      responseTimeHistogram: status.responseTimes.reduce((acc, time) => {
        const bucket = Math.floor(time / 100) * 100;
        acc[bucket] = (acc[bucket] || 0) + 1;
        return acc;
      }, {}),
    });
  }
  return statusArray;
}

export { monitorEvents };
