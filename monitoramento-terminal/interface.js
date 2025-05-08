import inquirer from 'inquirer';
import fs from 'fs/promises';
import chalk from 'chalk';
import blessed from 'blessed';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { monitorApiBack, getApiStatus, monitorEvents } from './monitor.js';

// CLI arguments
const argv = yargs(hideBin(process.argv))
  .option('config', {
    type: 'string',
    description: 'Path to config file',
    default: './config.json',
  })
  .help()
  .argv;

// Hacker-style ASCII spinner with glitch effect
const spinnerFrames = ['|', '/', '-', '\\', '█', '▒', ''];
const showSpinner = async (durationMs, message) => {
  const interval = 80;
  const steps = Math.floor(durationMs / interval);
  let i = 0;
  process.stdout.write(chalk.magenta(message));
  const intervalId = setInterval(() => {
    const frame = Math.random() < 0.1 ? spinnerFrames[Math.floor(Math.random() * spinnerFrames.length)] : spinnerFrames[i % spinnerFrames.length];
    process.stdout.write(chalk.blue(` ${frame}`));
    process.stdout.moveCursor(-2, 0);
    i++;
  }, interval);
  await new Promise((resolve) => setTimeout(resolve, durationMs));
  clearInterval(intervalId);
  process.stdout.write('  \n');
};

// Load URLs from file
async function loadUrls() {
  try {
    const fileData = await fs.readFile('./urls.json', 'utf-8');
    const { urls } = JSON.parse(fileData);
    return urls;
  } catch (error) {
    console.log(chalk.red(`[ERR] Failed to load URLs: ${error.message}`));
    return [];
  }
}

// Save URLs to file
async function saveUrls(urls) {
  try {
    await fs.writeFile('./urls.json', JSON.stringify({ urls }, null, 2));
  } catch (error) {
    console.log(chalk.red(`[ERR] Failed to save URLs: ${error.message}`));
  }
}

// Blessed TUI setup
const screen = blessed.screen({
  smartCSR: true,
  title: 'Consul ApiMonitor',
});
screen.key(['q', 'C-c'], () => process.exit(0));

// Welcome screen with hacker-style ASCII art
async function showWelcome() {
  const welcomeBox = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '70%',
    border: { type: 'line' },
    style: { border: { fg: 'magenta' } },
    content: [
      chalk.magenta.bold('  ╔════════════════════════════════════╗'),
      chalk.magenta.bold('  ║  C O N S U L   A P I M O N I T O R ║'),
      chalk.magenta.bold('  ║       v1.0.0   [HACKER MODE]       ║'),
      chalk.magenta.bold('  ╚════════════════════════════════════╝'),
      chalk.green('  >// Cyberpunk API Monitoring System'),
      chalk.green('  >// Initialized: 0x1A2B3C4D'),
      '',
      chalk.blue.italic('  Press Enter to infiltrate...'),
    ].join('\n'),
    align: 'center',
  });
  screen.render();
  await new Promise((resolve) => {
    screen.key(['enter'], () => {
      welcomeBox.destroy();
      resolve();
    });
  });
}

// Help screen with purple hacker vibe
function showHelp() {
  const helpBox = blessed.box({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '80%',
    height: '80%',
    border: { type: 'line' },
    style: { border: { fg: 'magenta' } },
    content: [
      chalk.magenta.bold('[//] Consul ApiMonitor Help'),
      '',
      chalk.blue('> Protocols:'),
      chalk.blue('- Monitor APIs with configurable intervals'),
      chalk.blue('- View real-time status (uptime, response, failures)'),
      chalk.blue('- Add/remove target URLs'),
      chalk.blue('- Deploy email alerts for failures (config.json)'),
      chalk.blue('- Persist status history in encrypted format'),
      '',
      chalk.blue('> Commands:'),
      chalk.blue('- Navigate menus with arrow keys'),
      chalk.blue('- Select with Enter'),
      chalk.blue('- Exit with Q or Ctrl+C'),
      chalk.blue('- Run with --config <path> for custom configs'),
      '',
      chalk.green('> Press Enter to return to mainframe...'),
    ].join('\n'),
    align: 'left',
  });
  screen.render();
  return new Promise((resolve) => {
    screen.key(['enter'], () => {
      helpBox.destroy();
      screen.render();
      resolve();
    });
  });
}

// Status dashboard with purple hacker styling
function showStatusDashboard() {
  const dashboard = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    border: { type: 'line' },
    style: { border: { fg: 'magenta' }, bg: 'black' },
  });

  const statusList = blessed.listtable({
    parent: dashboard,
    top: 1,
    left: 1,
    width: '98%',
    height: '90%',
    keys: true,
    tags: true,
    border: { type: 'line' },
    style: {
      border: { fg: 'magenta' },
      header: { fg: 'magenta', bold: true },
      cell: { fg: 'green', bg: 'black' },
    },
    align: 'left',
  });

  const updateStatus = () => {
    const status = getApiStatus();
    const rows = [['URL', 'Status', 'Last Checked', 'Uptime', 'Avg Response', 'Recent Failures']];
    status.forEach(({ url, status, lastChecked, uptime, avgResponseTime, recentFailures }) => {
      rows.push([
        chalk.white(url),
        status === 'online' ? chalk.green(status) : chalk.red(status),
        chalk.blue(lastChecked),
        chalk.green(uptime),
        chalk.cyan(avgResponseTime),
        recentFailures.length > 0 ? chalk.red(recentFailures[recentFailures.length - 1].error) : chalk.gray('None'),
      ]);
    });
    statusList.setData(rows);
    screen.render();
  };

  updateStatus();
  monitorEvents.on('status', updateStatus);

  const footer = blessed.text({
    parent: dashboard,
    bottom: 0,
    left: 1,
    content: chalk.green('Press Enter to return to mainframe...'),
    style: { fg: 'green' },
  });

  screen.render();
  return new Promise((resolve) => {
    screen.key(['enter'], () => {
      dashboard.destroy();
      monitorEvents.off('status', updateStatus);
      resolve();
    });
  });
}

// Main menu with purple hacker vibe
async function mainMenu() {
  console.clear();
  console.log(chalk.magenta.bold('[//] Consul ApiMonitor - Hacker Terminal\n'));
  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.magenta('> Select command:'),
      choices: [
        'List URLs',
        'View Status',
        'Add URL',
        'Remove URL',
        'Start Monitoring',
        'Help',
        'Exit',
      ],
      prefix: chalk.blue('>>'),
    },
  ]);

  switch (answer.action) {
    case 'List URLs':
      console.clear();
      await showSpinner(600, '[SYS] Loading URLs');
      const urls = await loadUrls();
      if (urls.length === 0) {
        console.log(chalk.red('[ERR] No URLs registered in system.'));
      } else {
        urls.forEach((url, index) => console.log(chalk.white(`[${index + 1}] ${url}`)));
      }
      console.log('');
      await inquirer.prompt({
        type: 'input',
        name: 'back',
        message: chalk.green('> Press Enter to continue...'),
      });
      await mainMenu();
      break;

    case 'View Status':
      await showStatusDashboard();
      await mainMenu();
      break;

    case 'Add URL':
      console.clear();
      console.log(chalk.magenta.bold('[//] Add New Target URL\n'));
      const { newUrl } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newUrl',
          message: chalk.magenta('> Enter URL:'),
          prefix: chalk.blue('+'),
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch {
              return chalk.red('[ERR] Invalid URL format. Try again.');
            }
          },
        },
      ]);
      const urlsToAdd = await loadUrls();
      urlsToAdd.push(newUrl);
      await saveUrls(urlsToAdd);
      await showSpinner(600, '[SYS] Adding URL to system');
      console.log(chalk.green('[OK] URL added to monitoring list.'));
      await inquirer.prompt({
        type: 'input',
        name: 'back',
        message: chalk.green('> Press Enter to continue...'),
      });
      await mainMenu();
      break;

    case 'Remove URL':
      console.clear();
      const urlsToRemove = await loadUrls();
      if (urlsToRemove.length === 0) {
        await showSpinner(600, '[SYS] Checking URLs');
        console.log(chalk.red('[ERR] No URLs available to remove.'));
        await inquirer.prompt({
          type: 'input',
          name: 'back',
          message: chalk.green('> Press Enter to continue...'),
        });
        await mainMenu();
        return;
      }
      console.log(chalk.magenta.bold('[//] Remove Target URL\n'));
      const { urlToRemove } = await inquirer.prompt([
        {
          type: 'list',
          name: 'urlToRemove',
          message: chalk.magenta('> Select URL to remove:'),
          choices: urlsToRemove.map((url) => chalk.white(url)),
          prefix: chalk.blue('-'),
        },
      ]);
      const updatedUrls = urlsToRemove.filter((url) => url !== urlToRemove);
      await saveUrls(updatedUrls);
      await showSpinner(600, '[SYS] Removing URL from system');
      console.log(chalk.green('[OK] URL removed from monitoring list.'));
      await inquirer.prompt({
        type: 'input',
        name: 'back',
        message: chalk.green('> Press Enter to continue...'),
      });
      await mainMenu();
      break;

    case 'Start Monitoring':
      console.clear();
      await showSpinner(1000, '[SYS] Initializing monitoring sequence');
      await monitorApiBack();
      break;

    case 'Help':
      await showHelp();
      await mainMenu();
      break;

    case 'Exit':
      console.clear();
      await showSpinner(600, '[SYS] Terminating session');
      console.log(chalk.magenta.bold('[//] Connection closed.'));
      process.exit(0);
  }
}


async function start() {
  console.clear();
  console.log(chalk.blue('> Booting Consul ApiMonitor...'));
  await new Promise((resolve) => setTimeout(resolve, 500));
  await showWelcome();
  await mainMenu();
}

start();