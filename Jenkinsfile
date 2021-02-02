// Load shared library at master branch
// the path to the repo with this library should be specified in Jenkins
// https://tomd.xyz/jenkins-shared-library/
// https://www.jenkins.io/doc/book/pipeline/shared-libraries/
@Library('nrp-shared-libs@master') _

pipeline {
    environment {
        USER_SCRIPTS_DIR = "user-scripts"
        ADMIN_SCRIPTS_DIR = "admin-scripts"
        NRP_BACKEND_PROXY_DIR = "nrpBackendProxy"
        // GIT_CHECKOUT_DIR is a dir of the main project (that was pushed)
        GIT_CHECKOUT_DIR = "${env.NRP_BACKEND_PROXY_DIR}"

        // define topic branch name
        TOPIC_BRANCH = selectTopicBranch(env.BRANCH_NAME, env.CHANGE_BRANCH)
        DEFAULT_BRANCH = 'development'

        HBP = "/home/bbpnrsoa/nrp/src"
    }
    agent {
        docker {
            // NEXUS_REGISTRY_IP and NEXUS_REGISTRY_PORT are Jenkins global variables
            image "${env.NEXUS_REGISTRY_IP}:${env.NEXUS_REGISTRY_PORT}/nrp_frontend:development"
            args '--entrypoint="" -u root --privileged'
        }
    }
    options { 
        // Skip code checkout prior running pipeline (only Jenkinsfile is checked out)
        skipDefaultCheckout true
    }

    stages {
        stage('Code checkout') {
            steps {
                sh 'rm -rf *'
                // Notify BitBucket on the start of the job
                // The Bitbucket Build Status Notifier is used
                // REF: https://plugins.jenkins.io/bitbucket-build-status-notifier/
                
                bitbucketStatusNotify(buildState: 'INPROGRESS', buildName: 'Code checkout')

                // Debug information on available environment
                echo sh(script: 'env|sort', returnStdout: true)

                // Checkout main project to GIT_CHECKOUT_DIR
                dir(env.GIT_CHECKOUT_DIR) {
                    checkout scm
                    sh 'sudo chown -R "${USER}" ./'
                }
            }
        }
        
        stage('Build and Test nrpBackendProxy') {
            steps {
                bitbucketStatusNotify(buildState: 'INPROGRESS', buildName: 'Building nrpBackendProxy')

                // Build operations (starting in .ci directory)
                dir( env.GIT_CHECKOUT_DIR){
                    // Determine explicitly the shell as bash
                    sh 'env > .ci/env'
                    sh 'sudo -H -u ${USER} bash ./.ci/build.bash'
                }
            }
        }
    }

    post {
        // always {
        //     cleanWs()
        // }
        aborted {
            bitbucketStatusNotify(buildState: 'FAILED', buildDescription: 'Build aborted!')
        }
        failure {
            bitbucketStatusNotify(buildState: 'FAILED', buildDescription: 'Build failed, see console output!')
        }
        success{
            bitbucketStatusNotify(buildState: 'SUCCESSFUL', buildDescription: 'branch ' + env.BRANCH_NAME)
        } 
    }
}
