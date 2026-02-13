const { exec } = require('child_process')
const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const mime = require('mime-types')
const { Kafka } = require('kafkajs')
const uuid = require('uuid')

const s3Client = new S3Client({
    region: 'ap-south-1',
    credentials: {
        accessKeyId: 'AKIASF2GBONGWDLPXOZT',
        secretAccessKey: '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'
    }
})

const PROJECT_ID = process.env.PROJECT_ID
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || uuid.v4() // Generate a random deployment ID if not provided

if (!process.env.DEPLOYMENT_ID) {
    console.warn('[env] DEPLOYMENT_ID missing, generated a new one')
}

console.log('[env]', { PROJECT_ID, DEPLOYMENT_ID })

const kafka = new Kafka({
    clientId: `api-docker`,
    brokers: ['kafka-278e95b5-shyampandey2625-1429.d.aivencloud.com:11331'],
     connectionTimeout: 10000,
     requestTimeout: 30000,    
    ssl: 
    {
        ca: [fs.readFileSync(path.join(__dirname, 'ca.pem'), 'utf-8')]
    },
    sasl: {
        username: 'avnadmin',
        password: 'AVNS_TVgmfSR1w7j7civJBPi',
        mechanism: 'plain'
    }
})

const producer = kafka.producer()

async function publishLog(log) {
    await producer.send({ topic: `container-logs`, messages: [{ key: 'log', value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log }) }] })
}

async function init() {

    await producer.connect()

    console.log('Executing script.js')
    await publishLog(`DEPLOYMENT_ID=${DEPLOYMENT_ID}`)
    await publishLog('Build Started...')
    const outDirPath = path.join(__dirname, 'output')

    const p = exec(`cd ${outDirPath} && npm install && npm run build`)

    p.stdout.on('data', async function (data) {
        console.log(data.toString())
        await publishLog(data.toString())
    })

    p.stderr.on('data', async function (data) {
        console.log('Error', data.toString())
        await publishLog(`error: ${data.toString()}`)
    })

    p.on('close', async function () {
        console.log('Build Complete')
        await publishLog(`Build Complete`)
        const distFolderPath = path.join(__dirname, 'output', 'dist')
        const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

        await publishLog(`Starting to upload`)
        for (const file of distFolderContents) {
            const filePath = path.join(distFolderPath, file)
            if (fs.lstatSync(filePath).isDirectory()) continue;

            console.log('uploading', filePath)
            await publishLog(`uploading ${file}`)

            const command = new PutObjectCommand({
                Bucket: 'newhosting-application',
                Key: `__outputs/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filePath),
                ContentType: mime.lookup(filePath)
            })

            await s3Client.send(command)
            await publishLog(`uploaded ${file}`)
            console.log('uploaded', filePath)
        }
        await publishLog(`Done`)
        console.log('Done...')
        process.exit(0)
    })
}

init()
