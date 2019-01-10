const path = require('path');
let q = require('q'),
  fs = require('fs');

var dateFormat = require('dateformat');
const pathLog = path.join(path.dirname(__dirname), 'usersLogged.log');

let log = user => {
  var message = user + '  ' + dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss\n');
  return q.denodeify(fs.appendFile)(pathLog, message).catch(err =>
    console.log(err)
  );
};

export default { log };
