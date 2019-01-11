import path from 'path';
import q from 'q';

// mocked in unit tests
// tslint:disable-next-line: prefer-const
let  fs = require('fs');

const dateFormat = require('dateformat');
const pathLog = path.join(path.dirname(__dirname), 'usersLogged.log');

const log = user => {
  const message = user + '  ' + dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss\n');
  return q.denodeify(fs.appendFile)(pathLog, message).catch(err =>
    console.log(err)
  );
};

export default { log };
