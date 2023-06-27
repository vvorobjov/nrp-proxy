// Load shared library at master branch
// the path to the repo with this library should be specified in Jenkins
// https://tomd.xyz/jenkins-shared-library/
// https://www.jenkins.io/doc/book/pipeline/shared-libraries/
@Library('nrp-shared-libs@master') _

pipeline {
    environment {
        NRP_BACKEND_PROXY_DIR = "nrp-proxy"
        // GIT_CHECKOUT_DIR is a dir of the main project (that was pushed)
        GIT_CHECKOUT_DIR = "${env.NRP_BACKEND_PROXY_DIR}"
    }
    agent {
        docker {
            label 'ci_label'
            alwaysPull true
            image "node:8"
        }
    }
    options { 
        // Skip code checkout prior running pipeline (only Jenkinsfile is checked out)
        skipDefaultCheckout true
    }

    stages {
        stage('Code checkout') {
            steps {
                // Debug information on available environment
                echo sh(script: 'env|sort', returnStdout: true)

                // Checkout main project to GIT_CHECKOUT_DIR
                dir(env.GIT_CHECKOUT_DIR) {
                    checkout scm
                }
            }
        }
        
        stage('Install') {
            steps {
                // Build operations (starting in .ci directory)
                dir(env.GIT_CHECKOUT_DIR){
                    // Determine explicitly the shell as bash
                    sh 'rm -rf node_modules'
                    sh 'rm -rf coverage'
                    sh 'npm install'
                }
            }
        }
        
        stage('Test Proxy') {
            steps {
                // Build operations (starting in .ci directory)
                dir( env.GIT_CHECKOUT_DIR){
                    sh 'bash ./.ci/test.bash'

                    // Fail on failed tests
                    junit(allowEmptyResults: true, testResults: 'junit.xml')
                    sh "test ${currentBuild.currentResult} != UNSTABLE"
                    
                    // get coverage reports
                    catchError(buildResult: 'UNSTABLE', stageResult: 'UNSTABLE', message: 'Test coverage has dropped') {
                        step([$class: 'CoberturaPublisher', 
                            autoUpdateHealth: true, 
                            autoUpdateStability: true, 
                            coberturaReportFile: 'coverage/cobertura-coverage.xml', 
                            failUnhealthy: false, 
                            failUnstable: true, 
                            maxNumberOfBuilds: 0, 
                            onlyStable: false, 
                            sourceEncoding: 'ASCII', 
                            zoomCoverageChart: false,
                            lineCoverageTargets: "0.0, 0.0, 0.0"])
                    }
                }
            }
        }
    }

    post {
        always {
            cleanWs()
        }
    }
}
