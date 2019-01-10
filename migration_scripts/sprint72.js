/*
Migrate local storage clned experiments indexing from token to user identifier
*/
import DB from '../storage/FS/DB';

DB.instance.experiments
  .find()
  .then(exps => exps.filter(exp => exp.token))
  .then(exps =>
    exps.forEach(exp => {
      DB.instance.users
        .findOne({ token: exp.token })
        .then(user => {
          if (!user)
            //already migrated
            return;
          return DB.instance.experiments.remove(exp).then(res => {
            return DB.instance.experiments.insert({
              experiment: exp.experiment,
              token: user.user
            });
          });
        })
        .catch(e => console.error('Failed migrate experiment: ' + e));
    })
  )
  .catch(e => console.error('Failed migrate experiments: ' + e));
