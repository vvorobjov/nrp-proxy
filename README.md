This repository is part of the Neurorobotics Platform software
Copyright (C) Human Brain Project
https://neurorobotics.ai

The Human Brain Project is a European Commission funded project
in the frame of the Horizon2020 FET Flagship plan.
http://ec.europa.eu/programmes/horizon2020/en/h2020-section/fet-flagships

You are free to clone this repository and amend its code with respect to
the license that you find in the root folder.

## Submitting a pull request

To submit code changes (pull requests) as a person external to the project, do as follows.

0. Log in to Bitbucket
1. Fork the project: "+" button, "Fork this repository".
2. Clone the forked project (eg. ```git clone git@bitbucket.org:[USERNAME]/[REPOSITORY].git```)
3. Enable the pipelines in the Pipelines menu (![wheel](https://bitbucket-connect-icons.s3.amazonaws.com/add-on/icons/62acf41d-386f-49fd-b823-4f86445390e2.svg) button on the left)
4. Create a branch. Give it an explicit name without spaces or special characters. Your change should refer to a ticket in Jira, that you or someone else created for this change. Then embed the ticket number in the branch
 Example: NUIT-10_my_new_feature
 (eg. ```git checkout -b NUIT-10_my_new_feature```)
5. Do your code changes
6. Commit your changes. 
  **Make sure** your commit message starts with [<ticket_number>].
   Example: "[NUIT-10] My new feature"
7. ```git push```
8. Click on the url provided on the console output for the previous command to create the pull request
9. A core developer will eventually review your pull request and approve or comment it

