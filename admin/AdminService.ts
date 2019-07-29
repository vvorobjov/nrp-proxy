import { spawn } from 'child_process';
import q from 'q';
import configurationManager from '../utils/configurationManager';

export default class AdminService {
  private busyServers = new Set();

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
      serverStatus.busy = this.busyServers.has(serverStatus.server);

    return serversStatus;
  }

  restartServer(server: string): Promise<string> {
    return this.executeScript('restart-backend', server);
  }

  retrieveServerLogs(server: string): Promise<string> {
    const targetFileName = `/tmp/backend_log_file${server}_${Date.now()}.tar.gz`;
    return this.executeScript(
      'collect-backend-logs',
      server,
      targetFileName
    ).then(() => targetFileName);
  }

  private executeScript(scriptName, server, ...args): Promise<string> {
    if (!this.config.backendScripts || !this.config.backendScripts[scriptName])
      return q.reject(`Could not find backend script ${scriptName}`);

    const scriptFile = configurationManager.resolveReplaceEnvVariables(
      this.config.backendScripts[scriptName]
    );

    if (this.busyServers.has(server))
      return q.reject('Server is already processing a request');
    this.busyServers.add(server);

    return q
      .Promise((resolve, reject) => {
        console.log(`Executing script ${scriptFile} on ${server}`);

        const prc = spawn(scriptFile, [server, ...args], {
          detached: true
        });
        let stdout = '';
        let stderr = '';

        prc.stdout.on('data', data => (stdout += data));
        prc.stderr.on('data', data => (stderr += data));

        prc.on('close', code => (code ? reject(stderr) : resolve(stdout)));
        prc.on('exit', code => (code ? reject(stderr) : resolve(stdout)));

        prc.on('error', err => reject(err));
      })
      .catch(err => {
        console.error(`Failed to execute script ${scriptFile} on ${server}:
${err}`);
        return err;
      })
      .finally(() => this.busyServers.delete(server));
  }
}
