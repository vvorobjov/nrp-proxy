import configurationManager from '../utils/configurationManager';

const q = require('q'),
  { spawn } = require('child_process');

export default class AdminService {
  private serversRestarting = new Set();

  constructor(private config, private proxyRequestHandler) {}

  getStatus(): Promise<{ maintenance: boolean }> {
    return q.resolve({
      maintenance: configurationManager.getState('maintenance') || false
    });
  }

  setStatus(maintenance: boolean): Promise<any> {
    configurationManager.setState('maintenance', maintenance);
    return q.resolve();
  }

  async getServersStatus() {
    const serversStatus = await this.proxyRequestHandler.getServersStatus();
    for (const serverStatus of serversStatus)
      serverStatus.restarting = this.serversRestarting.has(serverStatus.server);

    return serversStatus;
  }

  restartServer(server: string): Promise<any> {
    if (this.serversRestarting.has(server)) return q.reject('Server');
    this.serversRestarting.add(server);

    return q
      .Promise((resolve, reject) => {
        const RESTART_CMD = this.config['restart-backend-cmd'];

        console.log(`Restarting ${server}`);

        const prc = spawn(RESTART_CMD, [server], { detached: true });
        let stdout, stderr;
        stdout = stderr = '';

        prc.stdout.on('data', data => (stdout += data));
        prc.stderr.on('data', data => (stderr += data));

        prc.on('close', code => (code ? reject(stderr) : resolve(stdout)));
        prc.on('exit', code => (code ? reject(stderr) : resolve(stdout)));

        prc.on('error', err => reject(err));
      })
      .catch(err => {
        console.error(`Failed to restart ${server}:\n${err}`);
        throw err;
      })
      .finally(() => {
        this.serversRestarting.delete(server);
      });
  }
}
